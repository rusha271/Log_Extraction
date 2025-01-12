from flask import Flask, render_template
from Controller.fetch_logs_controller import init_routes

# Initialize the Flask app
app = Flask(__name__)

# Initialize routes from the controller
init_routes(app)

# Home route
@app.route('/')
def home():
    return render_template('index.html')

# Run the app using Waitress (for Windows)
if __name__ == '__main__':
    from waitress import serve
    print("Starting Waitress server...")
    serve(app, host="127.0.0.1", port=8080)