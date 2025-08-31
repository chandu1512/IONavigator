# backend/src/mongodb.py

from pymongo import MongoClient
import os


class MongoDBClient:
    def __init__(self):
        mongo_uri = os.getenv("MONGODB_URI", "your-mongo-uri-here")
        self.client = MongoClient(mongo_uri)
        self.db = self.client["ion-web-db"]
        # Make sure it's the correct collection
        self.collection = self.db["users"]

    def update_user_trace(self, user_id, trace_data):
        self.collection.update_one(
            {"user_id": user_id, "trace_name": trace_data["trace_name"]},
            {"$set": trace_data},
            upsert=True
        )

    def get_user_traces(self, user_id, search_query="", page=1, page_size=10):
        user = self.collection.find_one({'user_id': user_id})
        if not user or 'traces' not in user:
            return {
                "total": 0,
                "page": page,
                "page_size": page_size,
                "traces": []
            }

        all_traces = [
            {
                "trace_name": trace_name,
                **trace_info
            }
            for trace_name, trace_info in user['traces'].items()
            if search_query in trace_name.lower()
        ]

        total = len(all_traces)
        start = (page - 1) * page_size
        end = start + page_size
        paginated = all_traces[start:end]

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "traces": paginated
        }


def get_user_traces(self):
    traces_collection = self.db["traces"]
    traces = list(traces_collection.find({}, {"_id": 0}))  # exclude _id
    return traces
