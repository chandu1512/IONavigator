def get_router(model_name: str = "gpt-4o"):
    class DummyRouter:
        name = model_name
        def complete(self, *args, **kwargs):
            raise RuntimeError("LLM router not configured in this dev environment.")
    return DummyRouter()
