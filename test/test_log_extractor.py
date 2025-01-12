import unittest
import os
import tempfile
from datetime import datetime, time
from flask import Flask
from Model.model_log import LogExtractor, OptimizedLogExtractor
from Controller.fetch_logs_controller import init_routes

class TestLogExtractor(unittest.TestCase):
    def setUp(self):
        """Set up test data and environment."""
        self.log_extractor = LogExtractor()
        self.optimized_log_extractor = OptimizedLogExtractor()

        # Sample log data
        self.sample_logs = [
            "2023-10-01T12:00:00 INFO: This is a test log entry.",
            "2023-10-01T12:05:00 ERROR: Another test log entry.",
            "2023-10-01T12:10:00 DEBUG: Debugging log entry.",
            "2023-10-01T12:15:00 INFO: Final test log entry."
        ]

    def test_normalize_timestamp(self):
        """Test timestamp normalization."""
        # Test valid timestamps
        self.assertEqual(self.log_extractor.normalize_timestamp("2023-10-01T12:00:00"), "20231001120000")
        self.assertEqual(self.log_extractor.normalize_timestamp("12:00:00"), "120000")

        # Test invalid timestamps
        self.assertIsNone(self.log_extractor.normalize_timestamp("invalid-timestamp"))

    def test_extract_data(self):
        """Test log extraction with filters."""
        # Test extraction with time range and log type
        start_dt = datetime.fromisoformat("2023-10-01T12:00:00")
        end_dt = datetime.fromisoformat("2023-10-01T12:10:00")
        extracted_data = self.log_extractor._extract_data(
            self.sample_logs,
            start_dt=start_dt,
            end_dt=end_dt,
            log_type="INFO",
            seprator_type=" "
        )
        self.assertEqual(len(extracted_data), 1)
        self.assertIn("This is a test log entry.", extracted_data[0])

        # Test extraction with search text
        extracted_data = self.log_extractor._extract_data(
            self.sample_logs,
            search_Text="Debugging",
            seprator_type=" "
        )
        self.assertEqual(len(extracted_data), 1)
        self.assertIn("Debugging log entry.", extracted_data[0])

    def test_extract_and_save_data(self):
        """Test optimized log extraction and saving to a file."""
        # Create a temporary input file
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as input_file:
            input_file.write("\n".join(self.sample_logs))
            input_file_path = input_file.name

        # Create a temporary output file
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as output_file:
            output_file_path = output_file.name

        # Extract and save data
        self.optimized_log_extractor.extract_and_save_data(
            file_path=input_file_path,
            output_file=output_file_path,
            start_dt=datetime.fromisoformat("2023-10-01T12:00:00"),
            end_dt=datetime.fromisoformat("2023-10-01T12:10:00"),
            log_type="INFO",
            seprator_type=" "
        )

        # Verify the output file
        with open(output_file_path, 'r') as out_file:
            extracted_data = out_file.readlines()
            self.assertEqual(len(extracted_data), 1)
            self.assertIn("This is a test log entry.", extracted_data[0])

        # Clean up temporary files
        os.remove(input_file_path)
        os.remove(output_file_path)


class TestFetchController(unittest.TestCase):
    def setUp(self):
        """Set up Flask app for testing."""
        self.app = Flask(__name__)
        self.app.testing = True
        init_routes(self.app)
        self.client = self.app.test_client()

    def test_fetch_logs(self):
        """Test the /fetch_logs route."""
        # Create a temporary log file
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as log_file:
            log_file.write("\n".join([
                "2023-10-01T12:00:00 INFO: This is a test log entry.",
                "2023-10-01T12:05:00 ERROR: Another test log entry."
            ]))
            log_file_path = log_file.name

        # Send a POST request to /fetch_logs
        with open(log_file_path, 'rb') as file:
            response = self.client.post(
                '/fetch_logs',
                data={
                    'file': file,
                    'startTime': '2023-10-01T12:00:00Z',
                    'endTime': '2023-10-01T12:10:00Z',
                    'logType': 'INFO',
                    'sepratorType': ' ',
                    'searchText': 'test'
                },
                content_type='multipart/form-data'
            )

        # Verify the response
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"This is a test log entry.", response.data)

        # Clean up temporary file
        os.remove(log_file_path)


if __name__ == '__main__':
    unittest.main()