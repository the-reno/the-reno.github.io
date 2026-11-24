"""Run the local USD Cash Allocation model and its article walkthrough."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import secrets
import sys
import webbrowser
from collections import OrderedDict
from dataclasses import asdict, dataclass
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from statistics import mean
from threading import Lock
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

import sofr_model as model

ROOT = Path(__file__).resolve().parent
MAX_SHIFT_BP = 150
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
OVERNIGHT = (100, 0, 0, 0)
SIX_MONTH = (0, 0, 0, 100)
JULY_ARCHIVE = ROOT / "data" / "july-article.json"
JULY_CURVE = ROOT / "data" / "july-curve.csv"
SEPTEMBER_CURVE = ROOT / "curve.csv"
GITHUB_REPO = "the-reno/the-reno.github.io"
GITHUB_FOLDER = "tools/sofr-article-model"
GITHUB_BRANCH = "main"
GITHUB_INPUTS = ("data/july-curve.csv", "data/july-article.json", "curve.csv")
GITHUB_TIMEOUT = 5


@dataclass(frozen=True)
class RunInputs:
    scenario: int
    amount: float
    start_day: int
    weights: model.Weights
    shift_bp: int


class Simulator:
    def __init__(
        self,
        source: Path | bytes,
        profile: str = "september",
        *,
        article: bytes | None = None,
        source_label: str = "",
        source_url: str = "",
    ):
        self.profile = profile
        self.source_label = source_label
        self.source_url = source_url
        self.curve = model.load_curve(source) if isinstance(source, Path) else model.read_curve(source)
        self.first_day = self.curve[0].day
        self.anchor_day = self.curve[-1].day
        self.anchor_rates = self.curve[-1].rates
        self.decision_windows = model.historical_windows(self.curve)
        self.history = model.historical_summary(self.decision_windows)
        self.archived = None
        if profile == "july":
            self.archived = json.loads(JULY_ARCHIVE.read_bytes() if article is None else article)
            nodes = self.archived["scenario_nodes"]
            self.rules = model.JULY_RULES
            self.holding_days = model.JULY_HOLDING_DAYS
            self.runs = tuple(
                model.run_july_scenario(preset.name, [(row[0], row[i + 1]) for row in nodes])
                for i, preset in enumerate(model.PRESETS)
            )
        else:
            self.rules = model.SEPTEMBER_RULES
            self.holding_days = model.HOLDING_DAYS
            self.runs = tuple(model.run_scenario(self.anchor_rates, preset) for preset in model.PRESETS)
        self.horizon_days = len(self.runs[0].rates) - 1
        self.last_start_day = len(self.runs[0].windows) - 1
        self.anchor_day + timedelta(days=self.horizon_days)
        self.grid = model.allocation_grid(self.runs, self.rules, self.holding_days)
        self.reference, self.minimax = model.select_allocations(self.grid)
        if self.archived:
            self.minimax = min(self.grid, key=lambda mix: (mix.worst_regret_bp, mix.mean_regret_bp))
            self.reference = self.minimax

    def defaults(self) -> dict:
        source_name = {
            "july": "USD_Cash_Allocation_Data(2).xlsx · Historical_Rates",
            "september": "Curve 1-sep(1).csv",
            "custom": "Imported CSV",
        }[self.profile]
        return {
            "anchor_date": self.anchor_day.isoformat(),
            "historical_start": self.first_day.isoformat(),
            "profile": self.profile,
            "source_name": source_name,
            "source_label": self.source_label,
            "source_url": self.source_url,
            "observations": len(self.curve),
            "curve": dict(zip(model.TENORS, self.anchor_rates)),
            "scenarios": [p.name for p in model.PRESETS],
            "tenors": model.TENORS,
            "holding_days": self.holding_days,
            "horizon_days": self.horizon_days,
            "last_start_day": self.last_start_day,
            "max_shift_bp": 0 if self.archived else MAX_SHIFT_BP,
            "min_short_pct": self.rules.min_inside_one_month,
            "max_six_month_pct": self.rules.max_six_month,
            "rules": asdict(self.rules),
            "start_amount": 10_000_000,
            "candidate_count": len(self.grid),
            "reference": asdict(self.reference),
            "minimax": asdict(self.minimax),
            "history": self.history,
        }

    def analysis(self) -> dict:
        by_scenario = []
        for run in self.runs:
            metrics = self.scenario_metrics(run, self.reference.weights)
            by_scenario.append({
                "name": run.name,
                "days": self.holding_days,
                "starts": len(run.windows),
                "path": [[day, run.rates[day][0]] for day in
                         sorted({*range(0, self.horizon_days, 30), self.horizon_days})],
                "ladder": asdict(metrics),
                "overnight": asdict(self.scenario_metrics(run, OVERNIGHT)),
                "term": asdict(self.scenario_metrics(run, SIX_MONTH)),
            })
        first = self.decision_windows[0] if self.decision_windows else None
        mirror_summary = {
            "first": [first.rates_up_excess_bp, first.rates_down_excess_bp] if first else None,
            "mean": (
                [self.history["rates_up_excess_bp"], self.history["rates_down_excess_bp"]]
                if first else None
            ),
        }
        if self.archived:
            regrets = [row[1] for row in self.archived["reported_regret"]]
            archive = {
                **self.archived,
                "ladder_worst_bp": max(regrets),
                "ladder_mean_bp": mean(regrets),
            }
        else:
            archive = None
        return {
            **self.defaults(),
            "rates": [[point.day.isoformat(), *point.rates] for point in self.curve],
            "rate_summary": model.rate_summary(self.curve, self.decision_windows),
            "windows": [
                {
                    **asdict(window),
                    "start": window.start.isoformat(),
                    "unadjusted_maturity": window.unadjusted_maturity.isoformat(),
                    "maturity": window.maturity.isoformat(),
                }
                for window in self.decision_windows
            ],
            "mirror_rates": model.mirrored_paths(self.curve),
            "mirror_summary": mirror_summary,
            "scenario_results": by_scenario,
            "mix_grid": [
                [mix.worst_regret_bp, mix.mean_regret_bp, mix.average_annual_return] for mix in self.grid
            ],
            "archive": archive,
        }

    def scenario_metrics(self, run: model.Scenario, weights: model.Weights) -> model.MixResult:
        return model.mix_metrics(run.windows, weights, self.holding_days)

    def parse_inputs(self, query: str) -> RunInputs:
        fields = parse_qs(query, max_num_fields=8, keep_blank_values=True)
        try:
            scenario = int(fields.get("scenario", ["0"])[0])
            amount = Decimal(fields.get("amount", ["10000000"])[0])
            start_day = int(fields.get("start", ["0"])[0])
            shift = int(fields.get("shift", ["0"])[0])
            raw_weights = fields.get("weights", [",".join(map(str, self.reference.weights))])[0]
            weights = tuple(int(value) for value in raw_weights.split(","))
        except (ValueError, InvalidOperation) as error:
            raise ValueError("Enter a valid amount, entry day, and whole-percent weights.") from error
        if not 0 <= scenario < len(self.runs):
            raise ValueError("Choose one of the available scenarios.")
        if not 0 <= start_day <= self.last_start_day:
            raise ValueError(f"Choose an entry with {self.holding_days:,} model days remaining.")
        if not amount.is_finite() or not 1 <= amount <= 1_000_000_000_000:
            raise ValueError("Enter a USD amount between $1 and $1 trillion.")
        if len(weights) != 4 or min(weights) < 0 or sum(weights) != 100:
            raise ValueError("The four weights must total 100%.")
        if self.archived and shift:
            raise ValueError("The July comparison uses the five archived scenario paths.")
        if abs(shift) > MAX_SHIFT_BP:
            raise ValueError(f"Enter an overnight adjustment from −{MAX_SHIFT_BP} to +{MAX_SHIFT_BP} bp.")
        return RunInputs(scenario, float(amount), start_day, weights, shift)

    @lru_cache(maxsize=24)
    def adjusted_scenario(self, scenario: int, shift: int) -> model.Scenario:
        return model.run_scenario(self.anchor_rates, model.PRESETS[scenario], shift)

    def selected_scenario(self, inputs: RunInputs) -> model.Scenario:
        if inputs.shift_bp:
            return self.adjusted_scenario(inputs.scenario, inputs.shift_bp)
        return self.runs[inputs.scenario]

    def selected_return(self, window: model.DecisionWindow, inputs: RunInputs) -> dict:
        holding = model.mix_holding_return(window, inputs.weights)
        annual = model.annualize(holding, self.holding_days)
        return {
            "holding_return": holding,
            "annual_return": annual,
            "interest": inputs.amount * holding,
            "incremental_interest": inputs.amount * (holding - window.holding_returns[0]),
            "regret_bp": model.regret_bp(window, annual),
        }

    def simulate(self, inputs: RunInputs) -> dict:
        selected = self.selected_scenario(inputs)
        runs = [selected if i == inputs.scenario else base for i, base in enumerate(self.runs)]
        by_scenario = []
        for run in runs:
            metrics = self.scenario_metrics(run, inputs.weights)
            by_scenario.append({
                "name": run.name,
                "average_annual_return": metrics.average_annual_return,
                "worst_regret_bp": metrics.worst_regret_bp,
                "sample_count": len(run.windows),
            })
        entry = inputs.start_day
        maturity = entry + self.holding_days
        window = selected.windows[entry]
        benchmarks = [
            {
                "tenor": tenor,
                "holding_return": holding,
                "annual_return": annual,
                "interest": holding * inputs.amount,
            }
            for tenor, holding, annual in zip(
                model.TENORS, window.holding_returns, window.annual_returns
            )
        ]
        plot_days = sorted({entry, maturity, *range(0, self.horizon_days, 7), self.horizon_days})
        return {
            "scenario": selected.name,
            "start_date": (self.anchor_day + timedelta(days=entry)).isoformat(),
            "end_date": (self.anchor_day + timedelta(days=maturity)).isoformat(),
            "start_day": entry,
            "end_day": maturity,
            "weights": inputs.weights,
            "within_constraints": self.rules.accepts(inputs.weights),
            "amount": inputs.amount,
            "best_tenor": window.best_tenor,
            "shift_bp": inputs.shift_bp,
            **self.selected_return(window, inputs),
            "benchmarks": benchmarks,
            "by_scenario": by_scenario,
            "worst_regret_bp": max(row["worst_regret_bp"] for row in by_scenario),
            "path": [[day, selected.rates[day][0], selected.rates[day][3]] for day in plot_days],
        }

    def download(self, inputs: RunInputs) -> bytes:
        run = self.selected_scenario(inputs)
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow([
            "curve_date", "scenario", "extra_on_bp", "entry_date", "maturity_date",
            "holding_days", "selected_window", "cash_usd", "on_weight_pct", "1m_weight_pct",
            "3m_weight_pct", "6m_weight_pct", "mix_holding_return_decimal",
            "mix_annualized_return_decimal", "mix_interest_usd", "on_interest_usd",
            "interest_vs_on_usd", "best_pure_tenor", "annualized_regret_bp",
        ])
        for day, window in enumerate(run.windows):
            start = self.anchor_day + timedelta(days=day)
            result = self.selected_return(window, inputs)
            writer.writerow([
                self.anchor_day, run.name, inputs.shift_bp, start,
                start + timedelta(days=self.holding_days), self.holding_days,
                day == inputs.start_day, inputs.amount, *inputs.weights,
                result["holding_return"], result["annual_return"], result["interest"],
                window.holding_returns[0] * inputs.amount, result["incremental_interest"],
                window.best_tenor, result["regret_bp"],
            ])
        return output.getvalue().encode("utf-8-sig")

    def download_rates(self) -> bytes:
        return csv_bytes(("Date", *model.TENORS), ((p.day, *p.rates) for p in self.curve))

    def download_history(self) -> bytes:
        columns = model.HistoricalWindow.__dataclass_fields__.keys()
        return csv_bytes(columns, (asdict(window).values() for window in self.decision_windows))


def csv_bytes(columns, rows) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(columns)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8-sig")


def verify_v10(simulator: Simulator) -> None:
    """Reconcile representative figures against the companion workbook."""
    if (simulator.anchor_day.isoformat(), simulator.history.get("count")) != ("2026-09-01", 1036):
        raise ValueError("The baseline check uses the booklet's original 1 Sep 2026 curve.")
    if len(simulator.grid) != 228 or any(len(run.windows) != 916 for run in simulator.runs):
        raise ValueError("The candidate or decision-window count differs from v10.")
    if (simulator.reference.weights, simulator.minimax.weights) != ((0, 30, 0, 70), (20, 10, 0, 70)):
        raise ValueError("The baseline allocations differ from v10.")
    published = {
        "historical win rate": (simulator.history["win_rate"], 0.3137065637065637),
        "historical excess": (simulator.history["average_excess_bp"], -4.5732074261175475),
        "rates-up replay": (simulator.history["rates_up_excess_bp"], -21.8444437223517),
        "rates-down replay": (simulator.history["rates_down_excess_bp"], 9.150126166001177),
        "reference mix average return": (simulator.reference.average_annual_return, 0.03332918056054581),
        "reference mix regret": (simulator.reference.worst_regret_bp, 40.76924506589697),
        "minimum-regret mix average return": (simulator.minimax.average_annual_return, 0.033232029842728196),
        "minimum-regret mix regret": (simulator.minimax.worst_regret_bp, 39.520869860891764),
    }
    for label, (calculated, expected) in published.items():
        if not math.isclose(calculated, expected, rel_tol=0, abs_tol=1e-8):
            raise ValueError(f"{label} differs from v10. Calculated {calculated}, expected {expected}.")
    print("V10 baseline matched: 1,036 historical windows, 4,580 scenario windows, 228 mixes.")
    print(f"Reference mix worst regret: {simulator.reference.worst_regret_bp:.2f} annualized bp")
    print(f"Minimum-regret mix worst regret: {simulator.minimax.worst_regret_bp:.2f} annualized bp")


def verify_july(simulator: Simulator) -> None:
    if (len(simulator.curve), simulator.anchor_day.isoformat(), len(simulator.decision_windows)) != (
        1127, "2026-07-10", 1003
    ):
        raise ValueError("The July dataset or decision count differs from the article.")
    if len(simulator.grid) != 781 or simulator.minimax.weights != (10, 15, 25, 50):
        raise ValueError("The July calculation workbook's feasible grid or selected mix differs.")
    first = simulator.decision_windows[0]
    checks = [
        (simulator.history["win_rate"], 0.3240279162512463),
        (simulator.history["average_excess_bp"], -4.650730571868744),
        (simulator.history["priced_realized_correlation"], -0.2943414885996481),
        (first.rates_up_excess_bp, -23.65881827711247),
        (first.rates_down_excess_bp, 15.822054843979139),
        (simulator.minimax.worst_regret_bp, 3.054159417337221),
        (simulator.minimax.mean_regret_bp, 1.8891193058871991),
    ]
    for actual, expected in checks:
        if not math.isclose(actual, expected, rel_tol=0, abs_tol=1e-8):
            raise ValueError(f"July recalculation differs. Calculated {actual}, expected {expected}.")
    print("July baseline matched: 1,127 rate rows, 1,003 decisions, 32.4% 6M wins, -4.65 bp average excess.")
    print("July workbook matched: first-trade replay -23.66 / +15.82 bp, minimax regret 3.05 bp.")


def make_handler(
    models: dict[str, Simulator], default_model: str
):
    assets = {
        "/": ("index.html", "text/html; charset=utf-8"),
        "/styles.css": ("styles.css", "text/css; charset=utf-8"),
        "/app.js": ("app.js", "text/javascript; charset=utf-8"),
        "/walkthrough.js": ("walkthrough.js", "text/javascript; charset=utf-8"),
    }
    uploads: OrderedDict[str, Simulator] = OrderedDict()
    upload_lock = Lock()

    class Handler(BaseHTTPRequestHandler):
        def send_body(self, status, mime_type, body, filename=None):
            self.send_response(status)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            if filename:
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

        def send_json(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_body(status, "application/json; charset=utf-8", body)

        def get_model(self, query: str):
            fields = parse_qs(query, max_num_fields=8)
            key = fields.get("model", [default_model])[0]
            simulator = models.get(key)
            if simulator is None:
                with upload_lock:
                    simulator = uploads.get(key)
            if simulator is None:
                raise ValueError("Choose a built-in dataset or import the CSV again.")
            return key, simulator

        def do_GET(self):
            url = urlsplit(self.path)
            if url.path in assets:
                filename, mime_type = assets[url.path]
                self.send_body(200, mime_type, (ROOT / filename).read_bytes())
                return
            if url.path not in (
                "/defaults", "/model", "/simulate", "/results.csv", "/curve.csv", "/history.csv"
            ):
                self.send_error(404)
                return
            try:
                key, simulator = self.get_model(url.query)
                if url.path == "/defaults":
                    self.send_json(200, {"model_id": key, **simulator.defaults()})
                elif url.path == "/model":
                    self.send_json(200, {"model_id": key, **simulator.analysis()})
                elif url.path == "/curve.csv":
                    self.send_body(200, "text/csv; charset=utf-8", simulator.download_rates(), "SOFR_rates.csv")
                elif url.path == "/history.csv":
                    self.send_body(200, "text/csv; charset=utf-8", simulator.download_history(), "SOFR_decisions.csv")
                else:
                    inputs = simulator.parse_inputs(url.query)
                    if url.path == "/results.csv":
                        self.send_body(200, "text/csv; charset=utf-8", simulator.download(inputs),
                                       "SOFR_scenario_results.csv")
                    else:
                        self.send_json(200, simulator.simulate(inputs))
            except ValueError as error:
                self.send_json(400, {"error": str(error)})

        def do_POST(self):
            if urlsplit(self.path).path != "/model":
                self.send_error(404)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            if length <= 0 or length > MAX_UPLOAD_BYTES:
                self.send_json(400, {"error": "Choose a CSV file smaller than 2 MB."})
                return
            try:
                simulator = Simulator(self.rfile.read(length), "custom")
            except (ValueError, OverflowError) as error:
                self.send_json(400, {"error": str(error)})
                return
            key = secrets.token_urlsafe(12)
            with upload_lock:
                uploads[key] = simulator
                if len(uploads) > 8:
                    uploads.popitem(last=False)
            self.send_json(200, {"model_id": key, **simulator.analysis()})

        def log_message(self, _format, *_args):
            return

    return Handler


def fetch_github_file(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "Ronu-SOFR-Model"})
    with urlopen(request, timeout=GITHUB_TIMEOUT) as response:
        content = response.read(MAX_UPLOAD_BYTES + 1)
        expected_length = response.headers.get("Content-Length")
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("A GitHub data file exceeds 2 MB.")
    if expected_length and int(expected_length) != len(content):
        raise ValueError("A GitHub data file was incomplete.")
    return content


def github_models() -> tuple[Simulator, Simulator]:
    ref_url = f"https://api.github.com/repos/{GITHUB_REPO}/git/ref/heads/{GITHUB_BRANCH}"
    revision = json.loads(fetch_github_file(ref_url))["object"]["sha"]
    if not isinstance(revision, str) or not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("GitHub returned an invalid commit for the data files.")
    path = f"{GITHUB_REPO}/{revision}/{GITHUB_FOLDER}"
    july, article, september = [
        fetch_github_file(f"https://raw.githubusercontent.com/{path}/{filename}")
        for filename in GITHUB_INPUTS
    ]
    label = f"GitHub · {revision[:7]}"
    return (
        Simulator(
            july, "july", article=article, source_label=label,
            source_url=f"https://github.com/{GITHUB_REPO}/blob/{revision}/{GITHUB_FOLDER}/{GITHUB_INPUTS[0]}",
        ),
        Simulator(
            september, source_label=label,
            source_url=f"https://github.com/{GITHUB_REPO}/blob/{revision}/{GITHUB_FOLDER}/{GITHUB_INPUTS[2]}",
        ),
    )


def load_models(source: str) -> tuple[Simulator, Simulator]:
    label = "Local rate files"
    if source != "local":
        try:
            return github_models()
        except (OSError, KeyError, TypeError, ValueError) as error:
            if source == "github":
                raise ValueError(f"Could not load the GitHub datasets: {error}") from error
            label = "Local rate files · GitHub unavailable"
            print(f"Could not load the GitHub datasets. Using the local rate files. {error}", file=sys.stderr)
    return (
        Simulator(JULY_CURVE, "july", source_label=label),
        Simulator(SEPTEMBER_CURVE, source_label=label),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--curve", type=Path, help="Open with a custom rates CSV.")
    parser.add_argument("--port", type=int, default=8765, help="Use 0 to find an available port.")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--check", action="store_true", help="Verify both original model baselines.")
    parser.add_argument(
        "--source", choices=("auto", "github", "local"),
        help="Auto uses GitHub first. Choose github to require it or local to use the included files.",
    )
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("Choose a port between 0 and 65535.")
    try:
        july, september = load_models(args.source or ("local" if args.check else "auto"))
    except ValueError as error:
        parser.exit(1, f"{error}\n")
    if args.check:
        verify_july(july)
        verify_v10(september)
        return
    models = {"july": july, "september": september}
    default_model = "july"
    if args.curve:
        models["custom"] = Simulator(args.curve, "custom")
        default_model = "custom"
    with ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(models, default_model)) as server:
        url = f"http://127.0.0.1:{server.server_port}"
        print(f"SOFR simulator running at {url}. Press Ctrl+C to exit.", flush=True)
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
