import sys
import json
import numpy as np
from sklearn.ensemble import IsolationForest

def generate_mock_data(n_samples=100):
    np.random.seed(42)  # For reproducibility

    data = []
    for _ in range(n_samples):
        metric = {
            "cpu": np.random.normal(40, 10),                      # Simulated CPU %
            "mem": np.round(np.random.uniform(4.0, 15.5), 2),     # Simulated Memory GB (more realistic range)
            "connections": np.random.poisson(20),
            "query_count": np.random.poisson(300),
            "cache_hit_ratio": np.clip(np.random.normal(0.95, 0.02), 0, 1)
        }
        data.append(metric)
    return data

def main():
    try:
        raw_data = sys.argv[1]
        metrics = json.loads(raw_data)
    except (IndexError, json.JSONDecodeError):
        # If no input is passed, fall back to mock data
        metrics = generate_mock_data()

    # Features: cpu, mem, connections, query_count, cache_hit_ratio
    X = []
    for m in metrics:
        cpu = m.get('cpu', 0)
        mem = m.get('mem', 0)
        connections = m.get('connections', 0)
        query_count = m.get('query_count', 0)
        cache_hit_ratio = m.get('cache_hit_ratio', 0)
        X.append([cpu, mem, connections, query_count, cache_hit_ratio])

    X = np.array(X)

    model = IsolationForest(contamination=0.1)
    model.fit(X)
    preds = model.predict(X)  # -1 anomaly, 1 normal

    anomaly_indices = np.where(preds == -1)[0]
    median_vals = np.median(X, axis=0)

    anomaly_features = set()
    for idx in anomaly_indices:
        diff = X[idx] - median_vals
        for i, val in enumerate(diff):
            if abs(val) > median_vals[i] * 0.5:  # 50% deviation threshold
                if i == 0:
                    anomaly_features.add('cpu')
                elif i == 1:
                    anomaly_features.add('mem')
                elif i == 2:
                    anomaly_features.add('connections')
                elif i == 3:
                    anomaly_features.add('query_count')
                elif i == 4:
                    anomaly_features.add('cache_hit_ratio')

    anomaly_detected = len(anomaly_indices) > 0
    score = len(anomaly_indices) / len(preds) if len(preds) > 0 else 0

    result = {
        "anomaly": anomaly_detected,
        "score": float(score),
        "features": list(anomaly_features),
        "anomaly_count": len(anomaly_indices)
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()
