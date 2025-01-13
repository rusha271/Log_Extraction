import re
from datetime import datetime, time
import logging
import multiprocessing

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

    def _extract_data(self, data, start_dt=None, end_dt=None, log_type=None, start_index=None, seprator_type=None,
                      index_request=None, search_Text=None):
        extracted_data = []
        if not data:
            logger.warning("No data to process.")
            return extracted_data

        # Normalize start and end timestamps
        start_timestamp = self._normalize_datetime(start_dt) if start_dt else None
        end_timestamp = self._normalize_datetime(end_dt) if end_dt else None

        # Process lines in the data
        for line in data:
            try:
                if not line.strip():
                    logger.debug("Skipping empty or whitespace line.")
                    continue

                parts = re.split(re.escape(seprator_type), line.strip())

                if not parts:
                    logger.debug(f"Skipping malformed line: {line.strip()} (No parts found)")
                    continue

                # Dynamically find the timestamp and log type based on content
                timestamp_str = None
                req_res = None

                for i, part in enumerate(parts):
                    if start_index is not None and i == start_index:
                        timestamp_str = part
                    elif index_request is not None and i == index_request:
                        req_res = part
                    elif start_index is None and self.normalize_timestamp(part):
                        timestamp_str = part
                    elif index_request is None and log_type != "all" and log_type in part:
                        req_res = part

                if not timestamp_str:
                    logger.debug(f"No valid timestamp found in line: {line.strip()}")
                    continue

                normalized_timestamp = self.normalize_timestamp(timestamp_str)

                if not normalized_timestamp:
                    logger.debug(f"Invalid timestamp format in line: {line.strip()}")
                    continue

                # Skip if timestamp is outside the specified range
                if start_timestamp and normalized_timestamp < start_timestamp:
                    continue
                if end_timestamp and normalized_timestamp > end_timestamp:
                    continue

                # Check log type and search text
                if (log_type == "all" or (req_res and log_type in req_res)):
                    if search_Text:
                        # Only append the line if it contains the searchText
                        if search_Text in line:
                            extracted_data.append(line)
                    else:
                        # If no searchText is provided, append the line
                        extracted_data.append(line)

            except Exception as e:
                logger.error(f"Unexpected error processing line: {line.strip()}", exc_info=True)
                continue

        return extracted_data

    def _normalize_datetime(self, dt):
        if isinstance(dt, datetime):
            return dt.strftime("%Y%m%d%H%M%S")
        elif isinstance(dt, time):
            return dt.strftime("%H%M%S")
        else:
            return self.normalize_timestamp(dt)


class OptimizedLogExtractor(LogExtractor):
    def __init__(self):
        super().__init__()

    def extract_and_save_data(self, file_path, output_file, start_dt=None, end_dt=None, log_type=None, start_index=None, 
                              seprator_type=None, index_request=None, search_Text=None):
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                data = file.readlines()
                
            num_chunks = multiprocessing.cpu_count()
            chunk_size = max(len(data) // num_chunks, 1)
            chunks = [data[i:i + chunk_size] for i in range(0, len(data), chunk_size)]

            with multiprocessing.Pool(processes=num_chunks) as pool:
                results = pool.starmap(
                    self._extract_data,
                    [(chunk, start_dt, end_dt, log_type, start_index, seprator_type, index_request, search_Text) for chunk in chunks]
                )

            extracted_data = [item for sublist in results for item in sublist]

            with open(output_file, "w", encoding="utf-8") as out_file:
                out_file.writelines(extracted_data)

            return extracted_data

        except Exception as e:
            logger.error(f"Error in extract_and_save_data: {str(e)}", exc_info=True)
            raise