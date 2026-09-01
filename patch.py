with open("api/index.py", "r") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if "logger.error(f\"Failed to import modules: {import_error_details}\")" in line:
        new_lines.append("\n\n@asynccontextmanager\nasync def lifespan(app: FastAPI):\n    pass\n\napp = FastAPI(title=\"FinQorp API\", version=\"2.0.0\", lifespan=lifespan)\n\n@app.get(\"/api/debug\")\ndef debug_info():\n    return {\"status\": \"error\", \"traceback\": import_error_details}\n\n")

with open("api/index.py", "w") as f:
    f.writelines(new_lines)
