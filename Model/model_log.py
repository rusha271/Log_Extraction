import os
import re
import logging
import tempfile
import uuid
import threading
from datetime import datetime
from flask import request, Response

logger = logging.getLogger(__name__)

# Global variables to store session data
sessions = {}
session_lock = threading.Lock()

CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB chunks

class LogExtractor:
    def __init__(self):
        self.timestamp_formats = [
            "%Y%m%d%H%M%S",  # Full timestamp
            "%Y-%m-%dT%H:%M:%S",  # ISO datetime
            "%Y/%m/%d %H:%M:%S",  # Date with slash separator
            "%d-%m-%Y %H:%M:%S",  # Day first date
            "%H:%M:%S",  # Time-only
        ]

    def normalize_timestamp(self, timestamp_str):
        if not timestamp_str:
            return None

        # Handle full timestamp (YYYYMMDDHHMMSS)
        if len(timestamp_str) == 14:
            try:
                parsed_dt = datetime.strptime(timestamp_str, "%Y%m%d%H%M%S")
                return parsed_dt.strftime("%Y%m%d%H%M%S")
            except ValueError:
                pass

        # Handle time-only (HHMMSS)
        if len(timestamp_str) == 6:
            try:
                parsed_time = datetime.strptime(timestamp_str, "%H%M%S")
                return parsed_time.strftime("%H%M%S")
            except ValueError:
                pass

        # Handle other formats
        for fmt in self.timestamp_formats:
            try:
                parsed_dt = datetime.strptime(timestamp_str, fmt)
                return parsed_dt.strftime("%Y%m%d%H%M%S")
            except ValueError:
                continue

        logger.debug(f"Failed to normalize timestamp '{timestamp_str}'")
        return None

    def _extract_data(self, line, start_dt=None, end_dt=None, log_type=None, start_index=None, separator_type=None, index_request=None, search_Text=None):
        try:
            if not line.strip():
                logger.debug("Skipping empty or whitespace line.")
                return None, True

            # Split the line using the separator
            parts = re.split(re.escape(separator_type), line.strip()) if separator_type else [line.strip()]
            logger.debug(f"Split parts: {parts}")

            # Validate parts
            if not parts:
                logger.debug(f"Skipping malformed line: {line.strip()} (No parts found)")
                return None, True

            # Extract timestamp using start_index
            timestamp_str = None
            if start_index is not None:
                if -len(parts) <= start_index < len(parts):
                    timestamp_str = parts[start_index]
                else:
                    logger.debug(f"Invalid start_index: {start_index} for line: {line.strip()}")
                    return None, True
            else:
                logger.debug("No start_index provided.")
                return None, True

            if not timestamp_str:
                logger.debug(f"No valid timestamp found in line: {line.strip()}")
                return None, True

            normalized_timestamp = self.normalize_timestamp(timestamp_str)
            if not normalized_timestamp:
                logger.debug(f"Invalid timestamp format in line: {line.strip()}")
                return None, True

            # Convert start_dt and end_dt to normalized format
            if start_dt:
                start_dt = self.normalize_timestamp(start_dt)
            if end_dt:
                end_dt = self.normalize_timestamp(end_dt)

            # Check timestamp range
            if start_dt and normalized_timestamp < start_dt:
                logger.debug(f"Skipping line: timestamp {normalized_timestamp} before start_dt {start_dt}")
                return None, True
            if end_dt and normalized_timestamp > end_dt:
                logger.debug(f"Stopping processing: timestamp {normalized_timestamp} after end_dt {end_dt}")
                return None, False  # Stop processing

            # Check log type using index_request
            if log_type and log_type.lower() != "all":
                if index_request is not None:
                    if -len(parts) <= index_request < len(parts):
                        if parts[index_request].strip() != log_type:
                            logger.debug(f"Log type '{log_type}' not matched.")
                            return None, True
                    else:
                        logger.debug(f"Invalid index_request: {index_request} for line: {line.strip()}")
                        return None, True
                else:
                    logger.debug("No index_request provided.")
                    return None, True

            # Check search text
            if search_Text and search_Text not in line:
                logger.debug(f"Search text '{search_Text}' not found in line.")
                return None, True

            return (line if line.endswith('\n') else line + '\n'), True

        except Exception as e:
            logger.error(f"Error processing line: {line.strip()}", exc_info=True)
            return None, True

class OptimizedLogExtractor(LogExtractor):
    def extract_and_save_data(self, input_file, output_file, start_dt=None, end_dt=None, log_type=None, start_index=None, separator_type=None, index_request=None, search_Text=None):
        try:
            logger.info(f"""
                Processing with parameters:
                start_dt: {start_dt}
                end_dt: {end_dt}
                log_type: {log_type}
                start_index: {start_index}
                separator_type: {separator_type}
                index_request: {index_request}
                search_Text: {search_Text}
            """)

            with open(output_file, "w", encoding="utf-8") as outfile:
                buffer = ""
                while True:
                    chunk = input_file.read(CHUNK_SIZE)
                    if not chunk:
                        break

                    if isinstance(chunk, bytes):
                        chunk = chunk.decode("utf-8")

                    buffer += chunk
                    lines = buffer.splitlines(keepends=True)
                    buffer = lines[-1] if lines else ""

                    for line in lines[:-1]:
                        filtered_line, continue_processing = self._extract_data(
                            line, start_dt, end_dt, log_type, start_index, separator_type, index_request, search_Text
                        )
                        if filtered_line:
                            outfile.write(filtered_line)
                        if not continue_processing:
                            break  # Exit the loop if timestamp exceeds end_dt

                    if not continue_processing:
                        break  # Exit the chunk reading loop

            logger.info("Processing complete.")

        except Exception as e:
            logger.error(f"Error in extract_and_save_data: {e}", exc_info=True)
            raise