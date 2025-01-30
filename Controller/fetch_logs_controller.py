import os
import tempfile
import logging
from flask import request, Response
import uuid
from Model.model_log import OptimizedLogExtractor
import threading

logger = logging.getLogger(__name__)

# Define chunk size for reading files
CHUNK_SIZE = 10 * 1024 * 1024  # 1 MB chunks

# Global variables to store session data
sessions = {}
session_lock = threading.Lock()

def init_routes(app):
    @app.route('/fetch_logs', methods=['POST'])
    def fetch_logs():
        global sessions, session_lock

        try:
            # Log entire incoming request data for debugging
            logger.debug(f"Incoming request: form={request.form}, files={request.files}")

            step = request.form.get('step')
            if not step or step not in ['metadata', 'chunk', 'finalize']:
                logger.warning(f"Invalid or missing 'step': {step}")
                return "Invalid 'step' parameter. Must be 'metadata', 'chunk', or 'finalize'.", 400

            # Process the 'metadata' step
            if step == 'metadata':
                try:
                    start_index = request.form.get("startIndex")
                    index_request = request.form.get("indexRequest")

                    # Validate and convert start_index and index_request
                    start_index = int(start_index) - 1 if start_index else None
                    index_request = int(index_request) - 1 if index_request else None
                except ValueError:
                    logger.error("Invalid index values: startIndex or indexRequest is not an integer.")
                    return "Index values must be integers.", 400

                # Log metadata extraction
                metadata = {
                    "start_time": request.form.get("startTime"),
                    "end_time": request.form.get("endTime"),
                    "log_type": request.form.get("logType", "all"),
                    "start_index": start_index,
                    "separator_type": request.form.get("separatorType"),
                    "index_request": index_request,
                    "search_text": request.form.get("searchText"),
                }
                logger.debug(f"Extracted metadata: {metadata}")

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

                logger.info(f"Metadata received and session created: {session_id}")
                return session_id, 200

            # Process the 'chunk' step
            if step == 'chunk':
                session_id = request.form.get('sessionID')
                if not session_id or session_id not in sessions:
                    logger.warning(f"Invalid or missing 'sessionID': {session_id}")
                    return "Invalid 'sessionID'.", 400

                file_chunk = request.files.get("fileChunk")
                if not file_chunk:
                    logger.warning("Missing 'fileChunk' in request.")
                    return "Missing 'fileChunk'.", 400

                offset = int(request.form.get("offset", 0))
                logger.debug(f"Chunk received for session {session_id} with offset {offset}.")

                with open(sessions[session_id]['temp_file_path'], "ab") as temp_file:
                    temp_file.seek(offset)
                    temp_file.write(file_chunk.read())

                logger.info(f"Chunk appended to temporary file for session {session_id}.")
                return "Chunk received.", 200

            # Process the 'finalize' step
            if step == 'finalize':
                session_id = request.form.get('sessionID')
                if not session_id or session_id not in sessions:
                    logger.warning(f"Invalid or missing 'sessionID': {session_id}")
                    return "Invalid 'sessionID'.", 400

                session_data = sessions.pop(session_id, None)
                if not session_data:
                    logger.error(f"Session data not found for sessionID: {session_id}")
                    return "Session data not found.", 400

                log_extractor = OptimizedLogExtractor()

                try:
                    # Perform log extraction
                    logger.info(f"Starting log extraction for session {session_id}.")
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

                    # Read and return the extracted logs
                    with open(session_data['output_temp_file_path'], "r", encoding="utf-8") as output_file:
                        logs = output_file.read()
                        if not logs:
                            logger.info(f"No logs match the criteria for session {session_id}.")
                            return "No logs match the criteria.", 200

                    logger.info(f"Log extraction completed for session {session_id}.")
                    return Response(
                        logs,
                        mimetype='text/plain',
                        headers={'Content-Disposition': 'attachment; filename=filtered_logs.log'}
                    )

                finally:
                    # Cleanup temporary files
                    for path in [session_data['temp_file_path'], session_data['output_temp_file_path']]:
                        if os.path.exists(path):
                            try:
                                os.remove(path)
                                logger.debug(f"Temporary file removed: {path}")
                            except Exception as e:
                                logger.error(f"Error removing temporary file {path}: {e}")

        except Exception as e:
            logger.error(f"Error in fetch_logs: {e}", exc_info=True)
            return "Server error occurred.", 500