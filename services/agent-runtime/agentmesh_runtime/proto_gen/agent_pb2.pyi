from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class RunStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    RUN_STATUS_UNSPECIFIED: _ClassVar[RunStatus]
    RUN_STATUS_QUEUED: _ClassVar[RunStatus]
    RUN_STATUS_RUNNING: _ClassVar[RunStatus]
    RUN_STATUS_WAITING_APPROVAL: _ClassVar[RunStatus]
    RUN_STATUS_COMPLETED: _ClassVar[RunStatus]
    RUN_STATUS_FAILED: _ClassVar[RunStatus]
    RUN_STATUS_REJECTED: _ClassVar[RunStatus]

class RunEventType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    RUN_EVENT_TYPE_UNSPECIFIED: _ClassVar[RunEventType]
    RUN_STARTED: _ClassVar[RunEventType]
    NODE_STARTED: _ClassVar[RunEventType]
    NODE_FINISHED: _ClassVar[RunEventType]
    TOKEN_USAGE: _ClassVar[RunEventType]
    INTERRUPT: _ClassVar[RunEventType]
    RESUMED: _ClassVar[RunEventType]
    DONE: _ClassVar[RunEventType]
    FAILED: _ClassVar[RunEventType]
    LOG: _ClassVar[RunEventType]
RUN_STATUS_UNSPECIFIED: RunStatus
RUN_STATUS_QUEUED: RunStatus
RUN_STATUS_RUNNING: RunStatus
RUN_STATUS_WAITING_APPROVAL: RunStatus
RUN_STATUS_COMPLETED: RunStatus
RUN_STATUS_FAILED: RunStatus
RUN_STATUS_REJECTED: RunStatus
RUN_EVENT_TYPE_UNSPECIFIED: RunEventType
RUN_STARTED: RunEventType
NODE_STARTED: RunEventType
NODE_FINISHED: RunEventType
TOKEN_USAGE: RunEventType
INTERRUPT: RunEventType
RESUMED: RunEventType
DONE: RunEventType
FAILED: RunEventType
LOG: RunEventType

class ListAgentsRequest(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ListAgentsResponse(_message.Message):
    __slots__ = ("agents",)
    AGENTS_FIELD_NUMBER: _ClassVar[int]
    agents: _containers.RepeatedCompositeFieldContainer[AgentInfo]
    def __init__(self, agents: _Optional[_Iterable[_Union[AgentInfo, _Mapping]]] = ...) -> None: ...

class AgentInfo(_message.Message):
    __slots__ = ("name", "description", "version", "capabilities", "requires_approval")
    NAME_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    CAPABILITIES_FIELD_NUMBER: _ClassVar[int]
    REQUIRES_APPROVAL_FIELD_NUMBER: _ClassVar[int]
    name: str
    description: str
    version: str
    capabilities: _containers.RepeatedScalarFieldContainer[str]
    requires_approval: bool
    def __init__(self, name: _Optional[str] = ..., description: _Optional[str] = ..., version: _Optional[str] = ..., capabilities: _Optional[_Iterable[str]] = ..., requires_approval: _Optional[bool] = ...) -> None: ...

class StartRunRequest(_message.Message):
    __slots__ = ("run_id", "agent", "input", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    RUN_ID_FIELD_NUMBER: _ClassVar[int]
    AGENT_FIELD_NUMBER: _ClassVar[int]
    INPUT_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    run_id: str
    agent: str
    input: str
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, run_id: _Optional[str] = ..., agent: _Optional[str] = ..., input: _Optional[str] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class ResumeRunRequest(_message.Message):
    __slots__ = ("run_id", "approved", "feedback", "resume_payload_json")
    RUN_ID_FIELD_NUMBER: _ClassVar[int]
    APPROVED_FIELD_NUMBER: _ClassVar[int]
    FEEDBACK_FIELD_NUMBER: _ClassVar[int]
    RESUME_PAYLOAD_JSON_FIELD_NUMBER: _ClassVar[int]
    run_id: str
    approved: bool
    feedback: str
    resume_payload_json: str
    def __init__(self, run_id: _Optional[str] = ..., approved: _Optional[bool] = ..., feedback: _Optional[str] = ..., resume_payload_json: _Optional[str] = ...) -> None: ...

class GetRunRequest(_message.Message):
    __slots__ = ("run_id",)
    RUN_ID_FIELD_NUMBER: _ClassVar[int]
    run_id: str
    def __init__(self, run_id: _Optional[str] = ...) -> None: ...

class GetRunResponse(_message.Message):
    __slots__ = ("run_id", "agent", "status", "output_json", "interrupt_json", "usage", "error")
    RUN_ID_FIELD_NUMBER: _ClassVar[int]
    AGENT_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_JSON_FIELD_NUMBER: _ClassVar[int]
    INTERRUPT_JSON_FIELD_NUMBER: _ClassVar[int]
    USAGE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    run_id: str
    agent: str
    status: RunStatus
    output_json: str
    interrupt_json: str
    usage: TokenUsage
    error: str
    def __init__(self, run_id: _Optional[str] = ..., agent: _Optional[str] = ..., status: _Optional[_Union[RunStatus, str]] = ..., output_json: _Optional[str] = ..., interrupt_json: _Optional[str] = ..., usage: _Optional[_Union[TokenUsage, _Mapping]] = ..., error: _Optional[str] = ...) -> None: ...

class TokenUsage(_message.Message):
    __slots__ = ("prompt_tokens", "completion_tokens", "total_tokens")
    PROMPT_TOKENS_FIELD_NUMBER: _ClassVar[int]
    COMPLETION_TOKENS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_TOKENS_FIELD_NUMBER: _ClassVar[int]
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    def __init__(self, prompt_tokens: _Optional[int] = ..., completion_tokens: _Optional[int] = ..., total_tokens: _Optional[int] = ...) -> None: ...

class RunEvent(_message.Message):
    __slots__ = ("run_id", "agent", "type", "node", "seq", "timestamp", "payload_json", "usage", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    RUN_ID_FIELD_NUMBER: _ClassVar[int]
    AGENT_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    NODE_FIELD_NUMBER: _ClassVar[int]
    SEQ_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    PAYLOAD_JSON_FIELD_NUMBER: _ClassVar[int]
    USAGE_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    run_id: str
    agent: str
    type: RunEventType
    node: str
    seq: int
    timestamp: str
    payload_json: str
    usage: TokenUsage
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, run_id: _Optional[str] = ..., agent: _Optional[str] = ..., type: _Optional[_Union[RunEventType, str]] = ..., node: _Optional[str] = ..., seq: _Optional[int] = ..., timestamp: _Optional[str] = ..., payload_json: _Optional[str] = ..., usage: _Optional[_Union[TokenUsage, _Mapping]] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...
