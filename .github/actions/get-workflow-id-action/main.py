import os
import sys

import requests  # noqa We are just importing this to prove the dependency installed correctly


def main():
    token = os.environ.get("INPUT_ACCESS_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    file_name = os.environ.get("INPUT_WORKFLOW_FILE_NAME")
    if not (token and repo and file_name):
        return 1
    headers = {"Authorization": "token " + token}
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{file_name}"
    r = requests.get(url, headers=headers)
    if r.status_code != requests.codes.ok:
        return 1
    workflow_id = r.json().get("id", False)
    sys.stdout.write(f"::set-output name=workflow_id::{workflow_id}")
    return 0


if __name__ == "__main__":
    exit(main())
