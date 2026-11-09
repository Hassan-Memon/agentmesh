"""Generate Python gRPC stubs from proto/agentmesh/v1/*.proto.

Usage (from services/agent-runtime):
    uv run python -m scripts.gen_proto

Why a script instead of `protoc` on the PATH? `grpcio-tools` bundles protoc as a Python
module, so contributors on Windows, macOS or CI get identical output without installing
anything else. Generated files are committed so the runtime image does not need the
tools package at build time.

The generated `*_pb2_grpc.py` imports its sibling as `import agent_pb2`, which only works
when the output directory is on sys.path. We rewrite it to a package-relative import so
the stubs live cleanly under `agentmesh_runtime.proto_gen`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from grpc_tools import protoc

RUNTIME_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = RUNTIME_ROOT.parents[1]
PROTO_DIR = REPO_ROOT / "proto" / "agentmesh" / "v1"
OUT_DIR = RUNTIME_ROOT / "agentmesh_runtime" / "proto_gen"


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "__init__.py").write_text(
        '"""Generated gRPC stubs. Do not edit; run `uv run python -m scripts.gen_proto`."""\n'
    )
    protos = sorted(PROTO_DIR.glob("*.proto"))
    if not protos:
        print(f"no .proto files under {PROTO_DIR}", file=sys.stderr)
        return 1

    # grpc_tools ships the well-known types; include its path so imports like
    # google/protobuf/timestamp.proto resolve if we ever use them.
    import grpc_tools

    well_known = Path(grpc_tools.__file__).parent / "_proto"
    args = [
        "protoc",
        f"-I{PROTO_DIR}",
        f"-I{well_known}",
        f"--python_out={OUT_DIR}",
        f"--pyi_out={OUT_DIR}",
        f"--grpc_python_out={OUT_DIR}",
        *[str(p) for p in protos],
    ]
    rc = protoc.main(args)
    if rc != 0:
        return rc

    # Rewrite `import agent_pb2 as agent__pb2` -> `from . import agent_pb2 as agent__pb2`.
    for grpc_file in OUT_DIR.glob("*_pb2_grpc.py"):
        text = grpc_file.read_text()
        text = re.sub(r"^import (\w+_pb2) as", r"from . import \1 as", text, flags=re.MULTILINE)
        grpc_file.write_text(text)

    print(f"generated {len(protos)} proto(s) into {OUT_DIR.relative_to(REPO_ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
