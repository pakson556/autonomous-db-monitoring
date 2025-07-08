import sys
import json
import numpy as np
from sklearn.ensemble import IsolationForest

def main():
    raw_data = sys.argv[1]
    metrics = json.loads(raw_data)
    X = np.array([[m['cpu'], m['mem']] for m in metrics])

    model = IsolationForest(contamination=0.1)
    model.fit(X)
    preds = model.predict(X) 

    anomaly_count = np.sum(preds == -1)
    score = anomaly_count / len(preds)

    result = {
        "anomaly": bool(anomaly_count > 0),  
        "score": float(score)
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
