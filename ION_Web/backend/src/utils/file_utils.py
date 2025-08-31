# backend/src/utils/file_utils.py

import os


def load_darshan_log(filepath):
    """Dummy function to simulate loading a Darshan log file."""
    try:
        with open(filepath, 'r') as file:
            content = file.read()
        return content
    except Exception as e:
        raise IOError(f"Failed to read Darshan log: {e}")


def verify_and_parse_darshan_log(file_obj):
    """Dummy parser that simulates output structure."""
    try:
        # Simulate reading and parsing the file
        file_obj.seek(0)
        raw_data = file_obj.read().decode('utf-8', errors='ignore')

        modules = {
            "POSIX": {
                "description": "POSIX I/O description here",
                "dataframe": {
                    "dummy_col": ["val1", "val2"]
                }
            }
        }

        header_txt = "Dummy Darshan Header Content"
        header_json = '{"format": "dummy"}'
        return modules, header_txt, header_json
    except Exception as e:
        print(f"Failed to parse darshan log: {e}")
        return None, None, None
