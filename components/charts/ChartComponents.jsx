"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line, Pie, Scatter } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

// Common chart options
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: '#ffffff',
        font: {
          size: 12
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1
    }
  }
};

// Department Distribution Chart
export function DepartmentChart({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No department data available
      </div>
    );
  }

  const colors = [
    'rgba(59, 130, 246, 0.8)',   // Blue
    'rgba(16, 185, 129, 0.8)',  // Emerald
    'rgba(245, 158, 11, 0.8)',   // Amber
    'rgba(139, 92, 246, 0.8)',  // Purple
    'rgba(236, 72, 153, 0.8)',  // Pink
    'rgba(14, 165, 233, 0.8)',  // Sky
    'rgba(168, 85, 247, 0.8)',  // Violet
    'rgba(239, 68, 68, 0.8)',   // Red
    'rgba(20, 184, 166, 0.8)',  // Teal
    'rgba(249, 115, 22, 0.8)',  // Orange
  ];

  const borderColors = colors.map(c => c.replace('0.8', '1'));

  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        label: 'Number of Students',
        data: data.map(item => item.students || item.count || item.total || 0),
        backgroundColor: data.map((_, i) => colors[i % colors.length]),
        borderColor: data.map((_, i) => borderColors[i % borderColors.length]),
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...commonOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#ffffff',
          font: { weight: 'bold' }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        ticks: {
          color: '#ffffff',
          maxRotation: 45,
          minRotation: 45,
          font: { size: 11, weight: '500' }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={chartData} options={options} />
    </div>
  );
}

// Semester Distribution Chart
export function SemesterChart({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No semester data available
      </div>
    );
  }

  const chartData = {
    labels: data.map(item => item.semester),
    datasets: [
      {
        label: 'Records',
        data: data.map(item => item.count || item.total || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...commonOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={chartData} options={options} />
    </div>
  );
}

// Grade Distribution Chart
export function GradeChart({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No grade data available
      </div>
    );
  }

  const chartData = {
    labels: data.map(item => item.grade),
    datasets: [
      {
        label: 'Count',
        data: data.map(item => item.count),
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)', // Green for A
          'rgba(59, 130, 246, 0.8)', // Blue for B
          'rgba(245, 158, 11, 0.8)', // Yellow for C
          'rgba(239, 68, 68, 0.8)',  // Red for F
          'rgba(156, 163, 175, 0.8)', // Gray for others
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(156, 163, 175, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...commonOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={chartData} options={options} />
    </div>
  );
}

// Data Source Distribution Chart
export function DataSourceChart({ data }) {
  // Handle both object format { resultRecords, registrationRecords } and array format
  if (!data) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No data source information available
      </div>
    );
  }

  // If it's an array (old format), convert it
  let resultRecords = 0;
  let registrationRecords = 0;

  if (Array.isArray(data)) {
    // Old format: [{ name, count, percentage }]
    const resultData = data.find(item => item.name && item.name.includes('Result'));
    const regData = data.find(item => item.name && item.name.includes('Registration'));
    resultRecords = resultData?.count || resultData?.total || 0;
    registrationRecords = regData?.count || regData?.total || 0;
  } else {
    // New format: { resultRecords, registrationRecords }
    resultRecords = data.resultRecords || 0;
    registrationRecords = data.registrationRecords || 0;
  }

  // Show message only if resultRecords is 0 (registrationRecords can be 0)
  if (resultRecords === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No data source information available
      </div>
    );
  }

  // If registrationRecords is 0, analytics is using only the main Result database.
  // In that case, show a single slice so the chart isn't misleading.
  const labels = registrationRecords > 0
    ? ['Result Database', 'Registration Data']
    : ['Result Database'];

  const dataValues = registrationRecords > 0
    ? [resultRecords, registrationRecords]
    : [resultRecords];

  const backgroundColors = registrationRecords > 0
    ? [
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
      ]
    : ['rgba(59, 130, 246, 0.8)'];

  const borderColors = registrationRecords > 0
    ? [
        'rgba(59, 130, 246, 1)',
        'rgba(16, 185, 129, 1)',
      ]
    : ['rgba(59, 130, 246, 1)'];

  const chartData = {
    labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      legend: {
        ...commonOptions.plugins.legend,
        position: 'bottom',
      },
    },
  };

  return (
    <div className="h-80">
      <Doughnut data={chartData} options={options} />
    </div>
  );
}

// Batch Distribution Chart
export function BatchChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No batch data available
      </div>
    );
  }

  const chartData = {
    labels: data.map(item => item.batch),
    datasets: [
      {
        label: 'Number of Students',
        data: data.map(item => item.students || item.count || item.total || 0),
        backgroundColor: data.map((_, index) => {
          const colors = [
            'rgba(139, 92, 246, 0.8)', // Purple
            'rgba(59, 130, 246, 0.8)', // Blue
            'rgba(16, 185, 129, 0.8)', // Green
            'rgba(245, 158, 11, 0.8)', // Yellow
            'rgba(239, 68, 68, 0.8)', // Red
            'rgba(168, 85, 247, 0.8)', // Violet
            'rgba(34, 197, 94, 0.8)', // Emerald
          ];
          return colors[index % colors.length];
        }),
        borderColor: data.map((_, index) => {
          const colors = [
            'rgba(139, 92, 246, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(168, 85, 247, 1)',
            'rgba(34, 197, 94, 1)',
          ];
          return colors[index % colors.length];
        }),
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      tooltip: {
        ...commonOptions.plugins.tooltip,
        callbacks: {
          label: function (context) {
            return `Students: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Students',
          color: '#ffffff',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          color: '#ffffff',
          stepSize: 1,
          callback: function (value) {
            return value;
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Batch Year',
          color: '#ffffff',
          font: {
            size: 14,
            weight: 'bold'
          }
        },
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={chartData} options={options} />
    </div>
  );
}

// Monthly Trends Chart
export function MonthlyTrendsChart({ data }) {
  const chartData = {
    labels: data.map(item => item.month),
    datasets: [
      {
        label: 'Records Added',
        data: data.map(item => item.count),
        borderColor: 'rgba(236, 72, 153, 1)',
        backgroundColor: 'rgba(236, 72, 153, 0.2)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    ...commonOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  return (
    <div className="h-80">
      <Line data={chartData} options={options} />
    </div>
  );
}

// Performance Metrics Chart
export function PerformanceChart({ data }) {
  if (!data || (data.passedRecords === undefined && data.failedRecords === undefined)) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No performance data available
      </div>
    );
  }

  const chartData = {
    labels: ['Passed', 'Failed'],
    datasets: [
      {
        data: [data.passedRecords || 0, data.failedRecords || 0],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      legend: {
        ...commonOptions.plugins.legend,
        position: 'bottom',
      },
    },
  };

  return (
    <div className="h-80">
      <Pie data={chartData} options={options} />
    </div>
  );
}

// Advanced Chart Components

// Grade vs Credit Correlation Scatter Plot
export function GradeCreditCorrelationChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No correlation data available
      </div>
    );
  }

  const chartData = {
    datasets: [
      {
        label: 'Grade vs Credits',
        data: data.map(item => ({
          x: item.credits,
          y: item.points,
          label: `${item.subject} (${item.grade})`
        })),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const options = {
    ...commonOptions,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Credits',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        title: {
          display: true,
          text: 'Grade Points',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        beginAtZero: true,
        max: 10,
      },
    },
    plugins: {
      ...commonOptions.plugins,
      tooltip: {
        callbacks: {
          label: function (context) {
            return context.raw.label;
          }
        }
      }
    },
  };

  return (
    <div className="h-80">
      <Scatter data={chartData} options={options} />
    </div>
  );
}

// Department Performance Heatmap
export function DepartmentPerformanceHeatmap({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No department performance data available
      </div>
    );
  }

  const departments = data.map(item => item.department);
  const semesters = [...new Set(data.flatMap(item => item.semesters.map(s => s.semester)))].sort();

  const heatmapData = {
    labels: semesters,
    datasets: departments.map((dept, index) => {
      const deptData = data.find(d => d.department === dept);
      const colors = [
        'rgba(139, 92, 246, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(168, 85, 247, 0.8)',
      ];

      return {
        label: dept,
        data: semesters.map(sem => {
          const semData = deptData?.semesters.find(s => s.semester === sem);
          return semData ? parseFloat(semData.average) : 0;
        }),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length].replace('0.8', '1'),
        borderWidth: 2,
      };
    }),
  };

  const options = {
    ...commonOptions,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Semester',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        title: {
          display: true,
          text: 'Average Grade Points',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        beginAtZero: true,
        max: 10,
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={heatmapData} options={options} />
    </div>
  );
}

// Student Performance Distribution
export function StudentPerformanceDistributionChart({ data }) {
  const chartData = {
    labels: data.map(item => item.range),
    datasets: [
      {
        label: 'Number of Students',
        data: data.map(item => item.count),
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)', // Green for Excellent
          'rgba(59, 130, 246, 0.8)', // Blue for Good
          'rgba(245, 158, 11, 0.8)', // Yellow for Average
          'rgba(239, 68, 68, 0.8)', // Red for Below Average
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...commonOptions,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Students',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      x: {
        title: {
          display: true,
          text: 'Performance Range',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    },
  };

  return (
    <div className="h-80">
      <Bar data={chartData} options={options} />
    </div>
  );
}

// Subject Difficulty Analysis
export function SubjectDifficultyChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-white/60">
        No subject difficulty data available
      </div>
    );
  }

  const chartData = {
    labels: data.map(item => item.subject),
    datasets: [
      {
        label: 'Average Grade Points',
        data: data.map(item => parseFloat(item.average)),
        backgroundColor: data.map((item, index) => {
          const colors = [
            'rgba(239, 68, 68, 0.8)', // Red for difficult
            'rgba(245, 158, 11, 0.8)', // Yellow for medium
            'rgba(34, 197, 94, 0.8)', // Green for easy
          ];
          const avg = parseFloat(item.average);
          if (avg < 6) return colors[0];
          if (avg < 8) return colors[1];
          return colors[2];
        }),
        borderColor: data.map((item, index) => {
          const colors = [
            'rgba(239, 68, 68, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(34, 197, 94, 1)',
          ];
          const avg = parseFloat(item.average);
          if (avg < 6) return colors[0];
          if (avg < 8) return colors[1];
          return colors[2];
        }),
        borderWidth: 2,
      },
    ],
  };

  const options = {
    ...commonOptions,
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        max: 10,
        title: {
          display: true,
          text: 'Average Grade Points',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        title: {
          display: true,
          text: 'Subject Code',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    },
  };

  return (
    <div className="h-96">
      <Bar data={chartData} options={options} />
    </div>
  );
}

// Grade Trends Over Time
export function GradeTrendsOverTimeChart({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-white/60">
        No grade trends data available
      </div>
    );
  }

  const chartData = {
    labels: data.map(item => item.semester),
    datasets: [
      {
        label: 'Average Grade Points',
        data: data.map(item => parseFloat(item.average || 0)),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const options = {
    ...commonOptions,
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        title: {
          display: true,
          text: 'Average Grade Points',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      x: {
        title: {
          display: true,
          text: 'Semester',
          color: '#ffffff',
          font: { size: 14, weight: 'bold' }
        },
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    },
  };

  return (
    <div className="h-80">
      <Line data={chartData} options={options} />
    </div>
  );
}

// Top Performing Students Table
export function TopPerformingStudentsTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-white">
        <thead>
          <tr className="border-b border-white/20">
            <th className="text-left py-3 px-4 font-semibold">Rank</th>
            <th className="text-left py-3 px-4 font-semibold">Registration No</th>
            <th className="text-left py-3 px-4 font-semibold">Average</th>
            <th className="text-left py-3 px-4 font-semibold">Subjects</th>
            <th className="text-left py-3 px-4 font-semibold">Performance</th>
          </tr>
        </thead>
        <tbody>
          {data.map((student, index) => {
            const avg = parseFloat(student.average);
            let performanceColor = 'text-red-400';
            let performanceText = 'Below Average';

            if (avg >= 9) {
              performanceColor = 'text-green-400';
              performanceText = 'Excellent';
            } else if (avg >= 7) {
              performanceColor = 'text-blue-400';
              performanceText = 'Good';
            } else if (avg >= 5) {
              performanceColor = 'text-yellow-400';
              performanceText = 'Average';
            }

            return (
              <tr key={student.regNo} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                <td className="py-3 px-4">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 text-sm font-bold">
                    {index + 1}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-blue-300">{student.regNo}</td>
                <td className="py-3 px-4 font-bold">{student.average}</td>
                <td className="py-3 px-4">{student.totalSubjects}</td>
                <td className="py-3 px-4">
                  <span className={`font-semibold ${performanceColor}`}>
                    {performanceText}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
