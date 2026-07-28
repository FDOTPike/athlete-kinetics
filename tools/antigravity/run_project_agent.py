"""Run a workspace-confined Antigravity agent for Athlete Kinetics.

This is development tooling only. It is not imported by the mobile app and
does not add any cloud or model dependency to the shipped product.
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path
from typing import Literal


Role = Literal["builder", "auditor"]


def repository_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Antigravity SDK against this repository."
    )
    parser.add_argument(
        "--role",
        choices=("builder", "auditor"),
        default="auditor",
        help=(
            "builder may edit files; auditor is source-read-only. "
            "Defaults to auditor."
        ),
    )
    parser.add_argument(
        "--workspace",
        type=Path,
        default=repository_root(),
        help="Repository root exposed to the agent.",
    )
    parser.add_argument(
        "--work-order",
        type=Path,
        help=(
            "Ratified work-order file, relative to the workspace or absolute. "
            "Required for the builder role."
        ),
    )
    parser.add_argument(
        "--project",
        default=(
            os.environ.get("ANTIGRAVITY_VERTEX_PROJECT")
            or os.environ.get("GOOGLE_CLOUD_PROJECT")
        ),
        help=(
            "Google Cloud project. Prefer ANTIGRAVITY_VERTEX_PROJECT or "
            "GOOGLE_CLOUD_PROJECT instead of passing this flag."
        ),
    )
    parser.add_argument(
        "--location",
        default=(
            os.environ.get("ANTIGRAVITY_VERTEX_LOCATION")
            or os.environ.get("GOOGLE_CLOUD_LOCATION")
            or "australia-southeast1"
        ),
        help="Vertex AI location (default: australia-southeast1).",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("ANTIGRAVITY_MODEL"),
        help="Optional model override. When omitted, the SDK selects its default.",
    )
    parser.add_argument(
        "--app-data-dir",
        type=Path,
        default=None,
        help="Absolute Antigravity state directory outside the repository.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print the effective non-secret configuration, then exit.",
    )
    return parser.parse_args()


def resolve_inside_workspace(path: Path, workspace: Path, label: str) -> Path:
    resolved = path if path.is_absolute() else workspace / path
    resolved = resolved.resolve()
    try:
        resolved.relative_to(workspace)
    except ValueError as exc:
        raise ValueError(f"{label} must stay inside the workspace: {resolved}") from exc
    return resolved


def validate_args(args: argparse.Namespace) -> tuple[Path, Path | None, Path]:
    workspace = args.workspace.resolve()
    if not workspace.is_dir():
        raise ValueError(f"workspace does not exist: {workspace}")
    if not (workspace / "AGENT_WORKFLOW.md").is_file():
        raise ValueError(
            f"workspace does not look like Athlete Kinetics: {workspace}"
        )
    if not args.project:
        raise ValueError(
            "Vertex project is required. Set ANTIGRAVITY_VERTEX_PROJECT or "
            "GOOGLE_CLOUD_PROJECT."
        )

    work_order = None
    if args.work_order:
        work_order = resolve_inside_workspace(
            args.work_order, workspace, "work order"
        )
        if not work_order.is_file():
            raise ValueError(f"work order does not exist: {work_order}")
    if args.role == "builder" and work_order is None:
        raise ValueError("--work-order is required for the builder role")

    app_data_dir = (
        args.app_data_dir.expanduser().resolve()
        if args.app_data_dir
        else (
            Path.home()
            / ".gemini"
            / "antigravity"
            / "brain"
            / "athlete-kinetics"
            / args.role
        ).resolve()
    )
    if not app_data_dir.is_absolute():
        raise ValueError("app data directory must be absolute")
    try:
        app_data_dir.relative_to(workspace)
    except ValueError:
        pass
    else:
        raise ValueError("app data directory must stay outside the repository")

    return workspace, work_order, app_data_dir


def instructions_for(
    role: Role, workspace: Path, work_order: Path | None
) -> str:
    common = f"""
You are operating on the Athlete Kinetics repository at {workspace}.

Before taking any action, read AGENT_WORKFLOW.md in full and obey it. Treat the
working tree as dirty: preserve unrelated user and agent changes. There may be
only one writer at a time. Never use destructive Git commands, reset files,
discard changes, or stage, commit, push, merge, or publish unless Francis
explicitly authorizes that exact action. Existing migrations are frozen;
schema changes must follow the repository's append-only, generator-owned rules.

Use repository scripts and Windows-safe commands (including npm.cmd where
PowerShell execution policy requires it). Run verification proportional to the
change and distinguish clearly between implemented, tested, committed, and
pushed work. Stop at every ratified checkpoint and return evidence to Francis.
This agent is development tooling only; do not add a model, cloud service,
account, or network requirement to the shipped application.
""".strip()

    scope = (
        f"\n\nThe controlling work order is {work_order}. Read it in full and "
        "do not expand its scope."
        if work_order
        else ""
    )

    if role == "builder":
        role_text = """
You are the Antigravity implementation agent and the sole active writer. Execute
only the Francis-ratified work order. Do not approve your own requirements or
silently rewrite the work order. When requirements conflict or a checkpoint
needs judgment, stop and report the exact decision required. Keep changes
minimal, preserve architecture and safety invariants, and run the affected
verification gates before handing the repository back for independent audit.
""".strip()
    else:
        role_text = """
You are a source-read-only verification agent. Do not create, edit, delete,
format, or generate repository files. You may inspect files and, after the
interactive command approval, run non-mutating tests and verification gates.
Audit the live repository rather than trusting summaries. Report concrete
findings with file and line evidence, severity, reproduction or failed
invariant, and a GO/NO-GO recommendation. Do not implement the fixes you find.
""".strip()

    return f"{common}{scope}\n\n{role_text}"


def enabled_tools_for(role: Role):
    from google.antigravity import BuiltinTools

    shared = [
        BuiltinTools.LIST_DIR,
        BuiltinTools.SEARCH_DIR,
        BuiltinTools.FIND_FILE,
        BuiltinTools.VIEW_FILE,
        BuiltinTools.RUN_COMMAND,
        BuiltinTools.ASK_QUESTION,
        BuiltinTools.FINISH,
    ]
    if role == "builder":
        return [
            *shared[:4],
            BuiltinTools.CREATE_FILE,
            BuiltinTools.EDIT_FILE,
            *shared[4:],
        ]
    return shared


def build_config(
    args: argparse.Namespace,
    workspace: Path,
    work_order: Path | None,
    app_data_dir: Path,
):
    from google.antigravity import CapabilitiesConfig, LocalAgentConfig

    config_args = {
        "vertex": True,
        "project": args.project,
        "location": args.location,
        "capabilities": CapabilitiesConfig(
            enable_subagents=False,
            enabled_tools=enabled_tools_for(args.role),
        ),
        "system_instructions": instructions_for(
            args.role, workspace, work_order
        ),
        "workspaces": [str(workspace)],
        "app_data_dir": str(app_data_dir),
    }
    if args.model:
        config_args["model"] = args.model
    return LocalAgentConfig(**config_args)


def print_summary(
    args: argparse.Namespace,
    workspace: Path,
    work_order: Path | None,
    app_data_dir: Path,
) -> None:
    print("Antigravity Athlete Kinetics agent")
    print(f"  role:          {args.role}")
    print(f"  workspace:     {workspace}")
    print(f"  work order:    {work_order or '(audit scope supplied interactively)'}")
    print("  provider:      Vertex AI")
    print(f"  project:       {args.project}")
    print(f"  location:      {args.location}")
    print(f"  model:         {args.model or '(SDK default)'}")
    print(f"  app data:      {app_data_dir}")
    print("  subagents:     disabled")
    print(
        "  source writes: "
        + ("enabled inside workspace" if args.role == "builder" else "disabled")
    )
    print("  shell:         requires interactive approval")


async def run() -> None:
    args = parse_args()
    workspace, work_order, app_data_dir = validate_args(args)

    # Constructing the config also validates the installed SDK contract.
    config = build_config(args, workspace, work_order, app_data_dir)
    print_summary(args, workspace, work_order, app_data_dir)
    if args.dry_run:
        print("\nDry run passed; no agent session was started.")
        return

    from google.antigravity.utils.interactive import run_interactive_loop

    app_data_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(workspace)
    print("\nType 'exit' to end the session.\n")
    await run_interactive_loop(config)


def main() -> None:
    try:
        asyncio.run(run())
    except (ImportError, ValueError) as exc:
        raise SystemExit(f"Configuration error: {exc}") from exc


if __name__ == "__main__":
    main()
