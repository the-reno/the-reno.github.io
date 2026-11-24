"""Cash allocation calculations for the July article and September rerun.

Rates and returns are annual decimals unless the name says otherwise. A
historical excess is holding-period bp. Scenario regret is annualized bp.
"""

from __future__ import annotations

import calendar
import csv
import io
import math
from bisect import bisect_left
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import correlation, linear_regression, mean

TENORS = ("ON", "1M", "3M", "6M")
RESET_DAYS = (1, 30, 90, 180)
DAY_COUNT = 360
HOLDING_DAYS = 180
HORIZON_DAYS = 1095
LAST_START_DAY = HORIZON_DAYS - HOLDING_DAYS
BP = 10_000
MIN_SHORT_PCT = 30
MAX_SIX_MONTH_PCT = 70
GRID_STEP_PCT = 10
RATE_FLOOR = 0.0001
PREMIUM_DECAY_DAYS = 365  # Time constant in exp(-day / 365).
MIRROR_CENTER = 0.055
LONG_RUN_PREMIUM_BP = (1, 4, 8)
SENTIMENT_SENSITIVITY_BP = (5, 18, 45)
STRESS_SCALE = (0.2, 0.55, 1.0)

Rates = tuple[float, float, float, float]
Weights = tuple[int, int, int, int]


@dataclass(frozen=True)
class Preset:
    name: str
    # Anchor day, cumulative move in ON (bp), sentiment score.
    anchors: tuple[tuple[int, float, float], ...]
    # Peak day, width in days, amplitude for the 6M tenor (bp).
    pulses: tuple[tuple[int, int, float], ...]


PRESETS = (
    Preset(
        "Gradual normalization",
        ((0, 0, 0), (90, -10, .1), (180, -25, .2),
         (365, -75, -.15), (730, -110, -.25), (1095, -125, -.1)),
        ((120, 55, 25), (520, 90, -20)),
    ),
    Preset(
        "Higher for longer",
        ((0, 0, 0), (90, 10, .3), (180, 25, .5),
         (365, 35, .7), (730, 15, .4), (1095, -20, .15)),
        ((140, 75, 40), (420, 100, 30)),
    ),
    Preset(
        "Renewed inflation",
        ((0, 0, 0), (90, 20, .5), (180, 65, .85),
         (365, 100, 1), (730, 50, .55), (1095, 0, .15)),
        ((90, 55, 60), (260, 95, 85), (520, 110, 40)),
    ),
    Preset(
        "Faster normalization",
        ((0, 0, 0), (90, -25, -.3), (180, -75, -.55),
         (365, -125, -.65), (730, -150, -.35), (1095, -125, -.1)),
        ((100, 65, -30), (300, 95, -25), (650, 100, 10)),
    ),
    Preset(
        "Recession / rapid cuts",
        ((0, 0, 0), (90, -75, -.65), (180, -150, -1),
         (365, -200, -.8), (730, -175, -.35), (1095, -125, -.05)),
        ((70, 45, -60), (180, 80, -75), (480, 110, 30)),
    ),
)


@dataclass(frozen=True)
class CurvePoint:
    day: date
    rates: Rates


@dataclass(frozen=True)
class HistoricalWindow:
    start: date
    unadjusted_maturity: date
    maturity: date
    days: int
    start_on_rate: float
    start_six_month_rate: float
    on_return: float
    six_month_return: float
    spread_bp: float
    excess_bp: float
    rates_up_excess_bp: float
    rates_down_excess_bp: float


@dataclass(frozen=True)
class DecisionWindow:
    holding_returns: Rates
    annual_returns: Rates
    best_annual_return: float
    best_tenor: str


@dataclass(frozen=True)
class Scenario:
    name: str
    rates: tuple[Rates, ...]
    windows: tuple[DecisionWindow, ...]


@dataclass(frozen=True)
class MixResult:
    weights: Weights
    average_annual_return: float
    mean_regret_bp: float
    worst_regret_bp: float


@dataclass(frozen=True)
class AllocationRules:
    step: int
    min_on: int
    min_one_month: int
    min_inside_one_month: int
    max_six_month: int

    def accepts(self, weights: Weights) -> bool:
        on, one_month, _, six_month = weights
        return (
            on >= self.min_on
            and one_month >= self.min_one_month
            and on + one_month >= self.min_inside_one_month
            and six_month <= self.max_six_month
        )


SEPTEMBER_RULES = AllocationRules(GRID_STEP_PCT, 0, 0, MIN_SHORT_PCT, MAX_SIX_MONTH_PCT)
JULY_RULES = AllocationRules(5, 10, 15, 0, 50)
JULY_MONTH_DAYS = 30
JULY_HOLDING_DAYS = 36 * JULY_MONTH_DAYS


def load_curve(path: Path) -> list[CurvePoint]:
    """Load the booklet CSV or an ISO-dated CSV with the same fields."""
    return read_curve(path.read_bytes())


def read_curve(content: bytes) -> list[CurvePoint]:
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("Save the file as a UTF-8 CSV and try again.") from error
    reader = csv.reader(io.StringIO(decoded, newline=""), strict=True)
    points = []
    try:
        if next(reader, None) != ["Date", *TENORS]:
            raise ValueError("The curve CSV needs the columns Date,ON,1M,3M,6M.")
        for record in reader:
            if not record or (len(record) == 1 and not record[0].strip()):
                continue
            if len(record) != 5:
                raise ValueError(f"Row {reader.line_num} needs a date and four rates.")
            raw_date, *raw_rates = (field.strip() for field in record)
            try:
                try:
                    day = date.fromisoformat(raw_date)
                except ValueError:
                    day = datetime.strptime(raw_date, "%d-%b-%y").date()
                rates = tuple(float(rate) for rate in raw_rates)
            except ValueError as error:
                raise ValueError(f"Row {reader.line_num} needs a calendar date and annual decimal rates.") from error
            if not all(math.isfinite(rate) and -0.1 <= rate <= 0.3 for rate in rates):
                raise ValueError(
                    f"Enter plausible decimal rates on row {reader.line_num}, "
                    "such as 0.0366 for 3.66%."
                )
            if points and day <= points[-1].day:
                raise ValueError(f"Row {reader.line_num} is duplicated or out of order. Use dates oldest first.")
            points.append(CurvePoint(day, rates))
    except csv.Error as error:
        raise ValueError(f"Check the CSV formatting around row {reader.line_num}.") from error
    if len(points) < 2:
        raise ValueError("Include at least two dated observations.")
    return points


def add_months(day: date, months: int) -> date:
    month_index = day.month - 1 + months
    year, month_index = day.year + month_index // 12, month_index % 12
    month = month_index + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def compound_index(rates, gaps) -> list[float]:
    index = [1.0]
    for rate, days in zip(rates, gaps, strict=True):
        index.append(index[-1] * (1.0 + rate * days / DAY_COUNT))
    return index


def mirrored_paths(curve: list[CurvePoint]) -> list[Rates]:
    initial_on, _, _, initial_term = curve[0].rates
    rows = []
    for point in curve:
        on, _, _, term = point.rates
        on_move = on - initial_on
        term_move = term - initial_term
        rows.append(tuple(
            max(RATE_FLOOR, rate) for rate in (
                MIRROR_CENTER + on_move, MIRROR_CENTER + term_move,
                MIRROR_CENTER - on_move, MIRROR_CENTER - term_move,
            )
        ))
    return rows


def historical_windows(curve: list[CurvePoint]) -> list[HistoricalWindow]:
    """Run the same six-calendar-month windows on the actual and mirrored paths."""
    dates = [point.day for point in curve]
    gaps = [(end - start).days for start, end in zip(dates, dates[1:])]
    overnight = [point.rates[0] for point in curve]
    six_month = [point.rates[3] for point in curve]
    actual_index = compound_index(overnight[:-1], gaps)
    mirror = mirrored_paths(curve)
    up_index = compound_index((row[0] for row in mirror[:-1]), gaps)
    down_index = compound_index((row[2] for row in mirror[:-1]), gaps)

    results = []
    for start_index, start in enumerate(dates):
        unadjusted = add_months(start, 6)
        if unadjusted > dates[-1]:
            break
        maturity_index = bisect_left(dates, unadjusted)
        if dates[maturity_index].month != unadjusted.month:
            maturity_index -= 1
        if maturity_index <= start_index:
            continue
        maturity = dates[maturity_index]
        days = (maturity - start).days
        accrual = days / DAY_COUNT
        _, term_up, _, term_down = mirror[start_index]
        on_return = actual_index[maturity_index] / actual_index[start_index] - 1.0
        six_month_return = six_month[start_index] * accrual

        def excess(index, term):
            on_return = index[maturity_index] / index[start_index] - 1.0
            return (term * accrual - on_return) * BP

        results.append(HistoricalWindow(
            start, unadjusted, maturity, days, overnight[start_index], six_month[start_index],
            on_return, six_month_return, (six_month[start_index] - overnight[start_index]) * BP,
            (six_month_return - on_return) * BP, excess(up_index, term_up),
            excess(down_index, term_down),
        ))
    return results


def historical_summary(windows: list[HistoricalWindow]) -> dict:
    if not windows:
        return {"count": 0}
    spreads = [window.spread_bp for window in windows]
    excesses = [window.excess_bp for window in windows]
    priced_realized_correlation = trend = None
    if min(spreads) < max(spreads) and min(excesses) < max(excesses):
        priced_realized_correlation = correlation(spreads, excesses)
        slope, intercept = linear_regression(spreads, excesses)
        trend = {"slope": slope, "intercept": intercept, "r_squared": priced_realized_correlation ** 2}
    return {
        "count": len(windows),
        "win_rate": mean(value > 0 for value in excesses),
        "average_excess_bp": mean(excesses),
        "rates_up_excess_bp": mean(window.rates_up_excess_bp for window in windows),
        "rates_down_excess_bp": mean(window.rates_down_excess_bp for window in windows),
        "priced_realized_correlation": priced_realized_correlation,
        "trend": trend,
    }


def rate_summary(curve: list[CurvePoint], windows: list[HistoricalWindow]) -> dict:
    overnight = [point.rates[0] for point in curve]
    term = [point.rates[3] for point in curve]
    spreads = [(six - on) * BP for on, six in zip(overnight, term)]
    rows = [["Latest", overnight[-1], term[-1], spreads[-1]]]
    for name, function in (("Maximum", max), ("Minimum", min), ("Average", mean)):
        rows.append([name, function(overnight), function(term), function(spreads)])

    end = curve[0].day
    start = end
    on_factor = term_factor = 1.0
    by_start = {window.start: window for window in windows}
    while (window := by_start.get(end)) is not None:
        on_factor *= 1 + window.on_return
        term_factor *= 1 + window.six_month_return
        end = window.maturity
    if end == start:
        return {"rows": rows, "common_maturity": None}

    power = 365 / (end - start).days
    on_annual = on_factor ** power - 1
    term_annual = term_factor ** power - 1
    rows.append(["Annualized rolling return", on_annual, term_annual, (term_annual - on_annual) * BP])
    return {"rows": rows, "common_maturity": end.isoformat()}


def scenario_rates(curve: Rates, preset: Preset, extra_on_bp: int = 0) -> tuple[Rates, ...]:
    """Build the v10 daily curves, with an optional user-specified ON ramp."""
    overnight = []
    sentiment = []
    for (start, move, score), (end, next_move, next_score) in zip(
        preset.anchors, preset.anchors[1:]
    ):
        for day in range(start, end):
            fraction = (day - start) / (end - start)
            blend = fraction * fraction * (3.0 - 2.0 * fraction)
            overnight.append(move + (next_move - move) * blend)
            sentiment.append(score + (next_score - score) * blend)
    sentiment.append(preset.anchors[-1][2])
    overnight.append(preset.anchors[-1][1])
    overnight = [
        max(RATE_FLOOR, curve[0] + (move + extra_on_bp * min(day / HOLDING_DAYS, 1)) / BP)
        for day, move in enumerate(overnight)
    ]
    sentiment = [
        max(-1.0, min(1.0, score + 0.05 * math.sin(2.0 * math.pi * day / 45.0)))
        for day, score in enumerate(sentiment)
    ]
    extended_on = overnight + [overnight[-1]] * RESET_DAYS[-1]
    averages = [
        [sum(extended_on[day:day + tenor]) / tenor for day in range(len(overnight))]
        for tenor in RESET_DAYS[1:]
    ]
    initial_premiums = [quote - average[0] for quote, average in zip(curve[1:], averages)]

    rates = []
    for day, on in enumerate(overnight):
        decay = math.exp(-day / PREMIUM_DECAY_DAYS)
        stress_bp = sum(
            amplitude * math.exp(-0.5 * ((day - peak) / width) ** 2)
            for peak, width, amplitude in preset.pulses
        )
        terms = []
        for i, expected_on in enumerate(averages):
            normal = LONG_RUN_PREMIUM_BP[i] / BP
            premium = normal + (initial_premiums[i] - normal) * decay
            premium += (sentiment[day] * SENTIMENT_SENSITIVITY_BP[i]
                        + STRESS_SCALE[i] * stress_bp) / BP
            terms.append(max(RATE_FLOOR, expected_on[day] + premium))
        rates.append((on, *terms))
    return tuple(rates)


def annualize(holding_return: float, holding_days: int = HOLDING_DAYS) -> float:
    return (1.0 + holding_return) ** (DAY_COUNT / holding_days) - 1.0


def run_scenario(curve: Rates, preset: Preset, extra_on_bp: int = 0) -> Scenario:
    rates = scenario_rates(curve, preset, extra_on_bp)
    return run_rate_path(preset.name, rates, HOLDING_DAYS)


def run_july_scenario(name: str, nodes: list[tuple[int, float]]) -> Scenario:
    """Rebuild the July workbook's 36 monthly rates and strategy factors."""
    monthly = []
    for (start, rate), (end, next_rate) in zip(nodes, nodes[1:]):
        monthly.extend(
            rate + (next_rate - rate) * (month - start) / (end - start)
            for month in range(start, end)
        )
    monthly.append(nodes[-1][1])
    rates = tuple(
        (monthly[day // JULY_MONTH_DAYS],) * len(TENORS)
        for day in range(JULY_HOLDING_DAYS + 1)
    )
    return run_rate_path(name, rates, JULY_HOLDING_DAYS)


def run_rate_path(name: str, rates: tuple[Rates, ...], holding_days: int) -> Scenario:
    on_index = compound_index(
        (row[0] for row in rates[:-1]), [1] * (len(rates) - 1)
    )
    windows = []
    for start in range(len(rates) - holding_days):
        end = start + holding_days
        holding = [on_index[end] / on_index[start] - 1.0]
        for tenor_index, reset in enumerate(RESET_DAYS[1:], start=1):
            factor = math.prod(
                1.0 + rates[day][tenor_index] * min(reset, end - day) / DAY_COUNT
                for day in range(start, end, reset)
            )
            holding.append(factor - 1.0)
        annual = tuple(annualize(value, holding_days) for value in holding)
        best = max(range(len(TENORS)), key=annual.__getitem__)
        windows.append(DecisionWindow(tuple(holding), annual, annual[best], TENORS[best]))
    return Scenario(name, rates, tuple(windows))


def mix_holding_return(window: DecisionWindow, weights: Weights) -> float:
    return sum(weight * value for weight, value in zip(weights, window.holding_returns)) / 100


def regret_bp(window: DecisionWindow, annual_return: float) -> float:
    return max(0.0, (window.best_annual_return - annual_return) * BP)


def mix_metrics(
    windows: tuple[DecisionWindow, ...], weights: Weights, holding_days: int = HOLDING_DAYS
) -> MixResult:
    w0, w1, w3, w6 = (w / 100 for w in weights)
    returns = []
    regrets = []
    for window in windows:
        a, b, c, d = window.holding_returns
        annual = annualize(w0 * a + w1 * b + w3 * c + w6 * d, holding_days)
        returns.append(annual)
        regrets.append(regret_bp(window, annual))
    return MixResult(weights, mean(returns), mean(regrets), max(regrets))


def meets_constraints(weights: Weights) -> bool:
    return SEPTEMBER_RULES.accepts(weights)


def allocation_grid(
    scenarios: tuple[Scenario, ...],
    rules: AllocationRules = SEPTEMBER_RULES,
    holding_days: int = HOLDING_DAYS,
) -> tuple[MixResult, ...]:
    windows = tuple(window for scenario in scenarios for window in scenario.windows)
    grid = []
    for on in range(0, 101, rules.step):
        for one in range(0, 101 - on, rules.step):
            for three in range(0, 101 - on - one, rules.step):
                weights = (on, one, three, 100 - on - one - three)
                if rules.accepts(weights):
                    grid.append(mix_metrics(windows, weights, holding_days))
    return tuple(grid)


def select_allocations(grid: tuple[MixResult, ...]) -> tuple[MixResult, MixResult]:
    """The highest-return efficient point and the minimum-regret point."""
    reference = max(grid, key=lambda mix: (mix.average_annual_return, -mix.worst_regret_bp))
    minimax = min(grid, key=lambda mix: (mix.worst_regret_bp, -mix.average_annual_return))
    return reference, minimax
