import os
import tempfile
import logging
from datetime import datetime
from flask import request, Response
from Model.model_log import OptimizedLogExtractor

logger = logging.getLogger(__name__)

def init_routes(app):
    @app.route('/fetch_logs', methods=['POST'])
    def fetch_logs():
        temp_file_path = None
        output_temp_file_path = None

        try:
            # Validate file in request
            file = request.files.get('file')
            if not file or not file.filename:
                return "No file selected", 400

            # Extract and validate parameters
            try:
                start_time = request.form.get('startTime')
                end_time = request.form.get('endTime')
                log_type = request.form.get('logType', 'all')
                start_index = request.form.get('startIndex')
                seprator_type = request.form.get('sepratorType')
                index_request = request.form.get('indexRequest')
                search_Text = request.form.get('searchText')

                # Parse integer indices (convert to 0-based)
                start_index = int(start_index) - 1 if start_index else None
                index_request = int(index_request) - 1 if index_request else None

                # Parse datetime inputs
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00')) if start_time else None
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00')) if end_time else None
            except (ValueError, TypeError) as e:
                return f"Invalid input: {e}", 400

            # Save uploaded file to a temporary file
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                file.save(temp_file.name)
                temp_file_path = temp_file.name

            # Create a temporary output file
            output_temp_file = tempfile.NamedTemporaryFile(delete=False)
            output_temp_file_path = output_temp_file.name
            output_temp_file.close()

            # Initialize and process logs
            log_extractor = OptimizedLogExtractor()
            log_extractor.extract_and_save_data(
                file_path=temp_file_path,
                output_file=output_temp_file_path,
                start_dt=start_dt,
                end_dt=end_dt,
                log_type=log_type,
                start_index=start_index,
                seprator_type=seprator_type,
                index_request=index_request,
                search_Text = search_Text
            )

            # Read filtered logs
            with open(output_temp_file_path, 'r', encoding='utf-8') as output_file:
                filtered_logs = output_file.read()
                if not filtered_logs:
                    return "No logs match the criteria.", 200

                return Response(
                    filtered_logs,
                    mimetype='text/plain',
                    headers={'Content-Disposition': 'attachment; filename=filtered_logs.log'}
                )

        except Exception as e:
            logger.error(f"Error in fetch_logs: {e}", exc_info=True)
            return "Server error occurred.", 500

        finally:
            # Clean up temporary files
            for file_path in [temp_file_path, output_temp_file_path]:
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception as e:
                        logger.error(f"Error removing temporary file {file_path}: {e}")