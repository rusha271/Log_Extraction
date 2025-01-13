# My Flask Web App

## This is my website that i have deploy 
https://log-extraction.onrender.com

## Project Description

This is a Flask web application designed to serve as a log file viewer. It allows users to upload log files, filter them based on time ranges and log types, and download the filtered logs for further analysis.

## Project Structure

```
my_flask_app/
├── app/
│   ├── __init__.py
│   ├── routes.py
│   ├── Model/
    │   ├── __init__.py
│   │   └── model_log.py     
│   ├── templates/
│   │   ├── index.html
│   │   └── base.html
    ├── Controller/
    │   ├── __init__.py
│   │   └── fetch_logs_controller.py
│   └── static/
│       ├── css/
│       ├── js/
│       └── images/
├── migrations/
├── instance/
├── venv/
├── app.py
├── wsgi.py
├── requirements.txt
├── config.py
├── .env
├── .gitignore
└── README.md
```

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/my_flask_app.git
   ```

2. **Create a virtual environment:**

   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**

   Copy `.env.example` to `.env` and update the values:

   ```
   SECRET_KEY=your_secret_key
   DATABASE_URL=sqlite:///my_flask_app.db
   DEBUG=True
   ```

## Running the App

To run the app locally:

```bash
flask run
```

Access the app at `http://localhost:5000/` in your web browser.

## Configuration

- **Environment Variables:**

  - `SECRET_KEY`: Secret key for session management.
  - `DATABASE_URL`: URL for the database connection.
  - `DEBUG`: Enable debug mode (set to `True` for development).

## Deployment

1. **Set up a production server:**

   - Install Python, Nginx, and Gunicorn.
   - Configure Gunicorn to serve the Flask app.
   - Set up Nginx as a reverse proxy to forward requests to Gunicorn.

2. **SSL with Let's Encrypt:**

   - Install Let's Encrypt client.
   - Obtain and install SSL certificates for secure communication.

## Usage

- **Log Filtering:**

  - Upload a log file using the provided form.
  - Specify the time range, log type, and search text.
  - Download the filtered logs in `.log` format.

## Licensing

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Special thanks to contributors and open-source projects used in this application.

---

This README provides a comprehensive overview of the project, installation steps, configuration details, and usage instructions. It is designed to help developers understand and work with the application effectively.
