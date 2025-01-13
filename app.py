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

# Run the app using Flask's built-in development server
if __name__ == '__main__':
    print("Starting Flask development server...")
    app.run()