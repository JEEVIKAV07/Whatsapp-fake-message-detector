from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib

app = Flask(__name__)
CORS(app)

# Load model and vectorizer
model = joblib.load("whatsapp_model.pkl")
vectorizer = joblib.load("tfidf_vectorizer (1).pkl")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        message = data.get("message", "")

        if not message:
            return jsonify({"error": "No message provided"}), 400

        # Transform message into vector
        message_vector = vectorizer.transform([message])

        # Get prediction
        prediction = model.predict(message_vector)[0]

        return jsonify({"prediction": prediction})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)