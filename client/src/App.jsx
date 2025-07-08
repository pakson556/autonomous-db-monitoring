import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, CartesianGrid
} from "recharts";
import { ClipLoader } from "react-spinners";
import { FiAlertTriangle, FiDatabase, FiCpu, FiHardDrive, FiDownload, FiClock } from "react-icons/fi";
import { BsLightningCharge, BsGraphUp, BsMemory } from "react-icons/bs";

const socketUrl = "http://localhost:4000";

function downloadFile(filename, content, contentType = "application/json") {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButtons() {
  const exportData = async (endpoint, filename) => {
    try {
      const res = await fetch(endpoint);
      const data = await res.text();
      downloadFile(filename, data, res.headers.get("Content-Type"));
    } catch (err) {
      alert("Failed to export: " + err.message);
    }
  };

  return (
    <div className="flex flex-wrap gap-3 my-4">
      <button
        onClick={() => exportData(`${socketUrl}/api/export/metrics`, "metrics.json")}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
      >
        <FiDownload size={16} />
        Export Metrics (JSON)
      </button>

      <button
        onClick={() => exportData(`${socketUrl}/api/export/logs`, "logs.json")}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
      >
        <FiDownload size={16} />
        Export Logs (JSON)
      </button>

      <button
        onClick={() => exportData(`${socketUrl}/api/export/metrics.csv`, "metrics.csv")}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-sm"
      >
        <FiDownload size={16} />
        Export Metrics (CSV)
      </button>
    </div>
  );
}

function ResourceCard({ title, value, unit, icon, color, trend }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${color}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="mt-2 flex items-end">
            <p className="text-2xl font-semibold">{value}</p>
            {unit && <span className="ml-1 text-sm text-gray-500">{unit}</span>}
          </div>
        </div>
        <div className={`p-2 rounded-lg ${color.replace('bg-', 'bg-').replace('-500', '-100')}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-xs">
          <span className={`mr-1 ${trend.value > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-gray-500">vs last hour</span>
        </div>
      )}
    </div>
  );
}

function MiniChart({ data, color }) {
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2} 
            dot={false} 
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HistoricalChart({ data }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FiClock className="text-indigo-500" />
          Historical CPU & Memory Usage
        </h2>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
            <span>CPU Usage (%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span>Memory Usage (GB)</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 11 }} 
            tickMargin={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            yAxisId="left" 
            domain={[0, 100]} 
            tick={{ fontSize: 11 }} 
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            domain={[0, 16]} 
            tick={{ fontSize: 11 }} 
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: 'none'
            }}
          />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="cpu" 
            stroke="#6366f1" 
            strokeWidth={2}
            dot={false} 
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="mem" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={false} 
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AlertCard({ alert }) {
  const getAlertColor = (type) => {
    const typeStr = String(type || '').toLowerCase();
    switch(typeStr) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-amber-100 text-amber-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className={`p-3 rounded-lg mb-2 last:mb-0 ${getAlertColor(alert?.type)}`}>
      <div className="flex items-start gap-2">
        <FiAlertTriangle className="mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium">{alert?.type || 'Unknown Alert'}</div>
          <div className="text-sm">{alert?.message || `${alert?.value?.toFixed(1) || 'N/A'}`}</div>
          <div className="text-xs opacity-70 mt-1">
            {alert?.time ? new Date(alert.time).toLocaleTimeString() : 'No timestamp'}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogEntry({ log = {} }) {
  const getLogColor = (level = '') => {
    const levelStr = String(level).toLowerCase();
    switch(levelStr) {
      case 'error': return 'text-red-600';
      case 'warn': return 'text-amber-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex justify-between items-start">
        <div className={`text-sm font-mono ${getLogColor(log.level)}`}>
          {log.message || 'No message available'}
        </div>
        <div className="text-xs text-gray-400 whitespace-nowrap ml-2">
          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'No timestamp'}
        </div>
      </div>
      {log.context && (
        <div className="text-xs text-gray-500 mt-1">
          {JSON.stringify(log.context)}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const socketRef = useRef(null);
  const [cpu, setCPU] = useState([]);
  const [_mem, setMem] = useState([]); // Using _mem convention for unused var
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [anomaly, setAnomaly] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [dbStats, setDbStats] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState({ cpu: 0, mem: 0 });

  useEffect(() => {
    socketRef.current = io(socketUrl);
    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("✅ Connected to server:", socket.id);
    });

    // Initial fetch of data
    fetch(`${socketUrl}/api/metrics`).then(res => res.json()).then(data => {
      setCPU(Array(30).fill(0).map(() => ({ value: data.cpu })));
      setMem(Array(30).fill(0).map(() => ({ value: data.mem })));
      setCurrentMetrics({ cpu: data.cpu, mem: data.mem });
      setHistory([{ time: new Date(data.timestamp).toLocaleTimeString(), cpu: data.cpu, mem: data.mem }]);
    }).catch(err => {
      console.error("Failed to fetch metrics:", err);
    });
    
    fetch(`${socketUrl}/api/logs`)
      .then(res => res.json())
      .then(setLogs)
      .catch(err => {
        console.error("Failed to fetch logs:", err);
        setLogs([{ message: "Failed to load logs", level: "error" }]);
      });

    fetch(`${socketUrl}/api/ml/anomaly`)
      .then(res => res.json())
      .then(setAnomaly)
      .catch(console.error);

    fetch(`${socketUrl}/api/ml/optimizer`)
      .then(res => res.json())
      .then(setOptimization)
      .catch(console.error);

    fetch(`${socketUrl}/api/db/stats`)
      .then(res => res.json())
      .then(setDbStats)
      .catch(console.error);

    // Socket event listeners for live updates
    socket.on("metrics", metric => {
      setCPU(prev => [...prev.slice(-29), { value: metric.cpu }]);
      setMem(prev => [...prev.slice(-29), { value: metric.mem }]);
      setCurrentMetrics({ cpu: metric.cpu, mem: metric.mem });
      setHistory(prev => [...prev.slice(-49), {
        time: new Date(metric.timestamp).toLocaleTimeString(),
        cpu: metric.cpu,
        mem: metric.mem
      }]);
    });
    
    socket.on("log", log => {
      if (!log.level) {
        log.level = 'info'; // Default level if not provided
      }
      setLogs(prev => [log, ...prev.slice(0, 49)]);
    });

    socket.on("alert", alert => {
      if (!alert.type) {
        alert.type = 'warning'; // Default type if not provided
      }
      setAlerts(prev => [alert, ...prev.slice(0, 9)]);
    });

    socket.on("anomaly", setAnomaly);
    socket.on("optimization", setOptimization);
    socket.on("db_stats", setDbStats);

    socket.on("error", (err) => {
      console.error("Socket error:", err);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <header className="bg-white rounded-xl shadow-sm p-4 mb-6 sticky top-4 z-10 border border-gray-100">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BsGraphUp className="text-indigo-600" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              System Performance Dashboard
            </span>
          </h1>
          <div className="text-sm text-gray-500">
            Real-time monitoring
          </div>
        </div>
      </header>

      <main className="space-y-6">
        <ExportButtons />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ResourceCard 
            title="CPU Usage" 
            value={currentMetrics.cpu.toFixed(1)} 
            unit="%" 
            icon={<FiCpu size={20} className="text-indigo-600" />}
            color="bg-indigo-50"
            trend={{ value: 2.5 }}
          />
          <ResourceCard 
            title="Memory Usage" 
            value={currentMetrics.mem.toFixed(1)} 
            unit="GB" 
            icon={<BsMemory size={20} className="text-emerald-600" />}
            color="bg-emerald-50"
            trend={{ value: -1.2 }}
          />
          <ResourceCard 
            title="Database Connections" 
            value={dbStats[0]?.connections || 0} 
            icon={<FiDatabase size={20} className="text-amber-600" />}
            color="bg-amber-50"
          />
          <ResourceCard 
            title="Cache Hit Ratio" 
            value={dbStats[0] ? (dbStats[0].cache_hit_ratio * 100).toFixed(1) : 0} 
            unit="%" 
            icon={<BsLightningCharge size={20} className="text-purple-600" />}
            color="bg-purple-50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <HistoricalChart data={history} />
          </div>
          
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FiAlertTriangle className="text-red-500" />
                Anomaly Detection
              </h2>
              {anomaly ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${anomaly.anomaly ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
                    <div className="font-medium flex items-center gap-2">
                      {anomaly.anomaly ? (
                        <>
                          <FiAlertTriangle className="flex-shrink-0" />
                          <span>Anomaly Detected</span>
                        </>
                      ) : "System Normal"}
                    </div>
                    <div className="mt-2 text-sm">
                      Confidence: {anomaly.score?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">Recent Pattern:</div>
                    <MiniChart 
                      data={cpu.slice(-10).map((d, i) => ({ 
                        value: d.value,
                        time: i 
                      }))} 
                      color={anomaly.anomaly ? "#ef4444" : "#10b981"} 
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <ClipLoader size={24} color="#6366f1" />
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <BsLightningCharge className="text-purple-500" />
                Optimization Suggestion
              </h2>
              {optimization ? (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 text-blue-800 rounded-lg">
                    <div className="font-medium">{optimization.suggestion || 'No suggestion available'}</div>
                    <div className="text-sm mt-1">
                      Potential improvement: {(optimization.impact * 100)?.toFixed(1) || '0'}%
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Based on recent system patterns and performance metrics.</p>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <ClipLoader size={24} color="#6366f1" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FiDatabase className="text-amber-500" />
                Database Statistics
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connections</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Queries</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cache Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(Array.isArray(dbStats) ? dbStats.slice(0, 5) : []).map((stat, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {stat?.timestamp ? new Date(stat.timestamp).toLocaleTimeString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          {stat?.connections || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {stat?.query_count || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {stat?.cache_hit_ratio ? (stat.cache_hit_ratio * 100).toFixed(1) + '%' : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FiAlertTriangle className="text-red-500" />
                Active Alerts
              </h2>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {alerts.length > 0 ? (
                  alerts.map((a, i) => <AlertCard key={i} alert={a} />)
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    No active alerts
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                Recent Logs
              </h2>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {logs.length > 0 ? (
                  logs.slice(0, 8).map((log, i) => <LogEntry key={i} log={log} />)
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    No logs available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 py-6 text-center text-sm text-gray-500">
        <p>Real-time System Dashboard • Updated every second</p>
        <p className="mt-1">Last updated: {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}