"""Download the current SOFR project from GitHub and open it locally."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from http.client import HTTPException
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


REPOSITORY = "the-reno/the-reno.github.io"
PROJECT = "tools/sofr-article-model"
BRANCH = "main"
API = f"https://api.github.com/repos/{REPOSITORY}"
RAW = f"https://raw.githubusercontent.com/{REPOSITORY}"
SHA = re.compile(r"[a-f0-9]{40}")
FILE_NAME = re.compile(r"[a-zA-Z0-9_. -]+")
WINDOWS_DEVICE = re.compile(r"(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", re.IGNORECASE)
MAX_DOWNLOAD = 16 * 1024 * 1024
APP_FILES = {
    "app.py", "dataset_store.py", "sofr_model.py", "index.html", "styles.css",
    "app.js", "walkthrough.js", "curve.csv", "data/july-curve.csv", "data/july-article.json",
}


@dataclass(frozen=True)
class GitHubFile:
    path: str
    size: int
    sha: str


def default_cache_dir() -> Path:
    if sys.platform == "win32":
        directory = Path(os.getenv("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    elif sys.platform == "darwin":
        directory = Path.home() / "Library" / "Application Support"
    else:
        directory = Path(os.getenv("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return directory / "Ronu" / "SOFR_Article_Model" / "releases"


def read_url(url: str, limit: int = MAX_DOWNLOAD) -> bytes:
    request = Request(url, headers={"User-Agent": "Ronu-SOFR-Launcher"})
    for attempt in range(2):
        try:
            with urlopen(request, timeout=8) as response:
                return response.read(limit + 1)
        except HTTPError as error:
            if error.code < 500 or attempt:
                raise
        except (OSError, HTTPException):
            if attempt:
                raise


def read_json(url: str):
    content = read_url(url)
    if len(content) > MAX_DOWNLOAD:
        raise ValueError("The GitHub response was too large.")
    return json.loads(content)


def github_revision() -> str:
    revision = read_json(f"{API}/git/ref/heads/{BRANCH}")["object"]["sha"]
    if not isinstance(revision, str) or not SHA.fullmatch(revision):
        raise ValueError("GitHub did not return a valid commit.")
    return revision


def github_files(revision: str, directory: str = PROJECT) -> list[GitHubFile]:
    entries = read_json(f"{API}/contents/{quote(directory)}?ref={revision}")
    if not isinstance(entries, list):
        raise ValueError("GitHub did not return the project folder.")
    files = []
    for entry in entries:
        name = entry["name"]
        if not isinstance(name, str) or not FILE_NAME.fullmatch(name):
            raise ValueError("GitHub returned an invalid file name.")
        if name.endswith((" ", ".")) or WINDOWS_DEVICE.match(name):
            raise ValueError(f"GitHub returned an unsupported file name: {name}")
        path = f"{directory}/{name}"
        if entry["path"] != path:
            raise ValueError("A GitHub file was outside the requested project folder.")
        if entry["type"] == "dir":
            files.extend(github_files(revision, path))
        elif entry["type"] == "file":
            size, sha = entry["size"], entry["sha"]
            if not isinstance(size, int) or not 0 <= size <= MAX_DOWNLOAD or not SHA.fullmatch(sha):
                raise ValueError(f"GitHub returned invalid file metadata for {name}.")
            files.append(GitHubFile(path.removeprefix(PROJECT + "/"), size, sha))
        else:
            raise ValueError(f"GitHub returned an unsupported item: {name}")
    return files


def download_file(revision: str, file: GitHubFile, target: Path):
    content = read_url(f"{RAW}/{revision}/{PROJECT}/{quote(file.path)}", file.size)
    header = f"blob {len(content)}\0".encode("ascii")
    checksum = hashlib.sha1(header + content).hexdigest()
    if len(content) != file.size or checksum != file.sha:
        raise ValueError(f"GitHub file verification failed for {file.path}.")
    destination = target / file.path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)


def project_exists(path: Path) -> bool:
    return path.is_dir() and all((path / file).is_file() for file in APP_FILES)


def download_project(revision: str, cache: Path) -> Path:
    destination = cache / revision
    if project_exists(destination):
        os.utime(destination, None)
        return destination

    files = github_files(revision)
    available = {file.path for file in files}
    if not APP_FILES <= available or len({path.casefold() for path in available}) != len(files):
        raise ValueError("The GitHub model folder is incomplete.")
    cache.mkdir(parents=True, exist_ok=True)
    print(f"Downloading SOFR project {revision[:7]} from GitHub.", flush=True)
    with TemporaryDirectory(prefix="download-", dir=cache) as temp:
        staging = Path(temp) / "project"
        with ThreadPoolExecutor(max_workers=6) as pool:
            pending = [pool.submit(download_file, revision, file, staging) for file in files]
            for completed in pending:
                completed.result()
        try:
            staging.rename(destination)
        except OSError:
            if not project_exists(destination):
                raise
    return destination


def cached_project(cache: Path) -> Path | None:
    if not cache.is_dir():
        return None
    candidates = (path for path in cache.iterdir() if SHA.fullmatch(path.name) and project_exists(path))
    return max(candidates, key=lambda path: path.stat().st_mtime_ns, default=None)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--cache-dir", type=Path, default=default_cache_dir(),
                        help="Directory for downloaded versions of the project.")
    args, app_args = parser.parse_known_args()
    try:
        revision = github_revision()
        project = download_project(revision, args.cache_dir)
        print(f"Opening SOFR from GitHub {revision[:7]}.", flush=True)
    except (OSError, HTTPException, ValueError, KeyError, TypeError) as error:
        project = cached_project(args.cache_dir)
        if project:
            revision = project.name
            print(f"Could not load GitHub. Opening cached version {revision[:7]}.", flush=True)
        else:
            project = Path(__file__).resolve().parent
            if not project_exists(project):
                parser.exit(1, f"Could not download the SOFR project from GitHub. {error}\n")
            revision = None
            print("Could not load GitHub. Opening the local copy.", flush=True)
    command = [sys.executable, str(project / "app.py"), "--port", "0", *app_args, "--source", "local"]
    if revision:
        command.extend(("--github-revision", revision))
    return subprocess.call(command)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
