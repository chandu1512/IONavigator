import os, json, asyncio
async def extract_summary_info(config): await asyncio.sleep(0.01)
async def generate_rag_diagnosis(config): await asyncio.sleep(0.01)
async def intra_module_merge(config): await asyncio.sleep(0.01)
async def inter_module_merge(config):
    out_dir = os.path.join(config["analysis_root"], config.get("trace_name","trace"))
    os.makedirs(out_dir, exist_ok=True)
    return {"diagnosis": "Placeholder diagnosis", "sources": {"1":{"file":"placeholder.txt","text":"example"}}}
async def format_diagnosis_md(config, final_diagnosis):
    out_dir = os.path.join(config["analysis_root"], "final_diagnosis")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "final_diagnosis.json"), "w") as f:
        json.dump(final_diagnosis, f)
    return final_diagnosis
