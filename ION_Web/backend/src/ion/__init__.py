import os

def set_rag_dirs(config: dict) -> dict:
    analysis_root = config.get("analysis_root")
    if analysis_root:
        os.makedirs(analysis_root, exist_ok=True)
        # Subdir used by the stub Steps implementation
        os.makedirs(os.path.join(analysis_root, "final_diagnosis"), exist_ok=True)
    return config
