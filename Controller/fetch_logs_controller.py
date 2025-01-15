import os
import tempfile
import logging
from datetime import datetime
from flask import request, Response
import uuid
import re  # Added for regex operations
from Model.model_log import OptimizedLogExtractor
import threading

logger = logging.getLogger(__name__)

# Define chunk size for reading files
CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB chunks

# Global variables to store session data
sessions = {}
session_lock = threading.Lock()

def init_routes(app):
    @app.route('/fetch_logs', methods=['POST'])
    def fetch_logs():
        global sessions, session_lock

        try:
            step = request.form.get('step')
            if step not in ['metadata', 'chunk', 'finalize']:
                return "Invalid 'step' parameter.", 400

            if step == 'metadata':
                start_index = request.form.get("startIndex")
                index_request = request.form.get("indexRequest")
                try:
                    start_index = int(start_index) - 1 if start_index else None
                    index_request = int(index_request) - 1 if index_request else None
                except ValueError:
                    return "Index values must be integers.", 400

                metadata = {
                    "start_time": request.form.get("startTime"),
                    "end_time": request.form.get("endTime"),
                    "log_type": request.form.get("logType", "all"),
                    "start_index": start_index,
                    "separator_type": request.form.get("separatorType"),
                    "index_request": index_request,
                    "search_text": request.form.get("searchText"),
                }

                session_id = str(uuid.uuid4())
                temp_file_path = tempfile.NamedTemporaryFile(delete=False).name
                output_temp_file_path = tempfile.NamedTemporaryFile(delete=False).name

                with session_lock:
                    sessions[session_id] = {
                        'metadata': metadata,
                        'temp_file_path': temp_file_path,
                        'output_temp_file_path': output_temp_file_path,
                        'file_size_received': 0,
                    }

                logger.info(f"Metadata received for session {session_id}: {metadata}")
                return session_id, 200

            if step == 'chunk':
                session_id = request.form.get('sessionID')
                if not session_id or session_id not in sessions:
                    return "Invalid 'sessionID'.", 400

                file_chunk = request.files.get("fileChunk")
                if not file_chunk:
                    return "Missing 'fileChunk'.", 400

                with open(sessions[session_id]['temp_file_path'], "ab") as temp_file:
                    temp_file.seek(int(request.form.get("offset", 0)))
                    temp_file.write(file_chunk.read())

                return "Chunk received.", 200

            if step == 'finalize':
                session_id = request.form.get('sessionID')
                if not session_id or session_id not in sessions:
                    return "Invalid 'sessionID'.", 400

                session_data = sessions.pop(session_id, None)
                if not session_data:
                    return "Session data not found.", 400

                log_extractor = OptimizedLogExtractor()

                try:
                    with open(session_data['temp_file_path'], "rb") as input_file:
                        log_extractor.extract_and_save_data(
                            input_file=input_file,
                            output_file=session_data['output_temp_file_path'],
                            start_dt=session_data['metadata']["start_time"],
                            end_dt=session_data['metadata']["end_time"],
                            log_type=session_data['metadata']["log_type"],
                            start_index=session_data['metadata']["start_index"],
                            separator_type=session_data['metadata']["separator_type"],
                            index_request=session_data['metadata']["index_request"],
                            search_Text=session_data['metadata']["search_text"],
                        )

                    with open(session_data['output_temp_file_path'], "r", encoding="utf-8") as output_file:
                        logs = output_file.read()
                        if not logs:
                            return "No logs match the criteria.", 200

                    return Response(
                        logs,
                        mimetype='text/plain',
                        headers={'Content-Disposition': 'attachment; filename=filtered_logs.log'}
                    )

                finally:
                    # Cleanup temp files
                    for path in [session_data['temp_file_path'], session_data['output_temp_file_path']]:
                        if os.path.exists(path):
                            try:
                                os.remove(path)
                            except Exception as e:
                                logger.error(f"Error removing temporary file {path}: {e}")

        except Exception as e:
            logger.error(f"Error in fetch_logs: {e}", exc_info=True)
            return "Server error occurred.", 500