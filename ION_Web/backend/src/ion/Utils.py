import json
def get_config(path):
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}
def get_models(path):
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except Exception:
        return {}
