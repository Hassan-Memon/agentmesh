# gRPC and protobuf

**In one line:** gRPC is remote procedure calls over HTTP/2 with messages defined in a
`.proto` file; protobuf is the compact binary encoding of those messages.

## What a Python developer already knows

You have called REST APIs with `requests` and written FastAPI endpoints. gRPC is the same
idea, request in, response out, with three differences:

1. The contract is a file, not documentation. `proto/agentmesh/v1/agent.proto` declares
   every message and method. Both sides generate (or load) code from it.
2. Messages are binary, typed and small. A `RunEvent` with ten fields is a few dozen bytes.
3. Streaming is built in. A method can return a `stream` of messages over one connection.

## Reading the proto

```proto
service AgentService {
  rpc StartRun(StartRunRequest) returns (stream RunEvent);
}
message StartRunRequest {
  string run_id = 1;
  string agent = 2;
}
```

The number after `=` is the field tag. It is what goes on the wire, not the name, which is
why renaming a field is safe and renumbering is not. Adding fields with new numbers is
backwards compatible: old readers ignore them. `stream` on the return type makes it a
server-streaming RPC: one request, many responses.

Enums have an `_UNSPECIFIED = 0` entry because proto3 defaults every field to zero and a
missing enum should not silently mean "the first real value".

## The Python side

`scripts/gen_proto.py` calls the `protoc` bundled in `grpcio-tools` and writes
`agentmesh_runtime/proto_gen/agent_pb2.py` (messages) and `agent_pb2_grpc.py` (service
base class and client stub). We commit these so the Docker image needs no generator.

`server.py` subclasses `AgentServiceServicer` and implements each method as an `async def`.
A streaming method is just an async generator: `yield event_to_proto(event)`. gRPC handles
flow control; if the client reads slowly, `yield` waits.

Errors are status codes, not exceptions on the wire: `await context.abort(grpc.StatusCode.
NOT_FOUND, "...")`. The gateway maps them to HTTP (404, 409, 412).

## The Node side

No codegen. `@grpc/proto-loader` parses the `.proto` at startup
(`apps/gateway/src/grpc/agent-grpc.client.ts`):

```ts
const definition = protoLoader.loadSync(protoPath, { keepCase: true, enums: String, longs: Number });
const pkg = grpc.loadPackageDefinition(definition);
const client = new pkg.agentmesh.v1.AgentService(address, grpc.credentials.createInsecure());
```

`keepCase: true` keeps snake_case so field names match the JSON the Python side publishes on
the bus. `enums: String` gives `'NODE_STARTED'` instead of `2`. The resulting client is
untyped, so `grpc/types.ts` holds hand-written interfaces mirroring the proto. A streaming
call returns a Node `Readable`, which is async-iterable: `for await (const ev of stream)`.

## HTTP/2 and deployment

gRPC requires HTTP/2 end to end. Inside Docker compose that is automatic. On a PaaS, check
that the platform forwards HTTP/2 to your container (Render does). Browsers cannot speak
raw gRPC, which is one reason the gateway exists: it turns gRPC into REST and WebSockets.

## When you would not use gRPC

Public APIs consumed by browsers or third parties (REST + JSON is friendlier), or a service
boundary that changes daily during prototyping (the proto adds ceremony). Between two
internal services you control, especially with streaming, gRPC pays for itself quickly.

## Try it

`cd services/agent-runtime && uv run pytest tests/test_grpc_server.py -v` starts a real
in-process server and exercises every method, including error codes.
