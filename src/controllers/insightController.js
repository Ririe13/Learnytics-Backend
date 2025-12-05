const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/dummy.json');

const loadData = () => {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        return [];
    }
};

exports.getSummary = (req, res) => {
    const data = loadData();
    const { start, end, cohort, module } = req.query;

    let filtered = [...data];
    if (start) filtered = filtered.filter(r => new Date(r.date) >= new Date(start));
    if (end) filtered = filtered.filter(r => new Date(r.date) <= new Date(end));
    if (cohort) filtered = filtered.filter(r => r.cohort === cohort);
    if (module) filtered = filtered.filter(r => r.module === module);

    const uniqueStudents = [...new Set(filtered.map(r => r.studentId))];
    const totalStudents = uniqueStudents.length;
    const avgScore = filtered.reduce((sum, r) => sum + r.score, 0) / filtered.length || 0;
    const completionRate = filtered.filter(r => r.completed).length / filtered.length || 0;
    const avgTimeSpent = filtered.reduce((sum, r) => sum + r.durationMinutes, 0) / filtered.length || 0;

    // Trend data
    const trendMap = {};
    filtered.forEach(r => {
        const date = r.date.split('T')[0];
        if (!trendMap[date]) trendMap[date] = { sum: 0, count: 0 };
        trendMap[date].sum += r.score;
        trendMap[date].count += 1;
    });
    const trend = Object.entries(trendMap).map(([date, { sum, count }]) => ({ date, avgScore: sum / count })).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Module performance
    const moduleMap = {};
    filtered.forEach(r => {
        if (!moduleMap[r.module]) moduleMap[r.module] = { sum: 0, count: 0 };
        moduleMap[r.module].sum += r.score;
        moduleMap[r.module].count += 1;
    });
    const modulePerformance = Object.entries(moduleMap).map(([module, { sum, count }]) => ({ module, avgScore: sum / count, count }));

    // Completion status
    const completedCount = filtered.filter(r => r.completed).length;
    const inProgressCount = filtered.filter(r => !r.completed).length;
    const total = completedCount + inProgressCount;
    const completionStatus = [
        { status: 'completed', count: completedCount, percentage: completedCount / total || 0 },
        { status: 'in-progress', count: inProgressCount, percentage: inProgressCount / total || 0 },
        { status: 'not-started', count: 0, percentage: 0 }
    ];

    // Score-time correlation
    const scoreTimeCorrelation = uniqueStudents.map(studentId => {
        const studentRecords = filtered.filter(r => r.studentId === studentId);
        return {
            studentId,
            studentName: studentRecords[0]?.studentName || '',
            totalMinutes: studentRecords.reduce((sum, r) => sum + r.durationMinutes, 0),
            avgScore: studentRecords.reduce((sum, r) => sum + r.score, 0) / studentRecords.length
        };
    });

    res.json({
        kpi: { totalStudents, avgScore: Math.round(avgScore), completionRate, avgTimeSpent: Math.round(avgTimeSpent) },
        trend, modulePerformance, completionStatus, engagement: [], scoreTimeCorrelation
    });
};

exports.getStudentDetail = (req, res) => {
    const { studentId } = req.params;
    const data = loadData();
    const studentRecords = data.filter(r => r.studentId === studentId);

    if (studentRecords.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Student not found' });
    }

    res.json({
        studentId,
        studentName: studentRecords[0].studentName,
        cohort: studentRecords[0].cohort,
        avgScore: Math.round(studentRecords.reduce((sum, r) => sum + r.score, 0) / studentRecords.length),
        completionRate: studentRecords.filter(r => r.completed).length / studentRecords.length,
        totalTimeSpent: studentRecords.reduce((sum, r) => sum + r.durationMinutes, 0),
        moduleScores: studentRecords.map(r => ({ module: r.module, score: r.score, completed: r.completed }))
    });
};

exports.getLeaderboard = (req, res) => {
    const data = loadData();
    const { limit = 10, cohort, module } = req.query;

    let filtered = [...data];
    if (cohort) filtered = filtered.filter(r => r.cohort === cohort);
    if (module) filtered = filtered.filter(r => r.module === module);

    const studentMap = {};
    filtered.forEach(r => {
        if (!studentMap[r.studentId]) {
            studentMap[r.studentId] = { studentId: r.studentId, studentName: r.studentName, cohort: r.cohort, scores: [], completedCount: 0, totalCount: 0, totalMinutes: 0 };
        }
        studentMap[r.studentId].scores.push(r.score);
        studentMap[r.studentId].totalCount += 1;
        studentMap[r.studentId].totalMinutes += r.durationMinutes;
        if (r.completed) studentMap[r.studentId].completedCount += 1;
    });

    const leaderboard = Object.values(studentMap).map(student => ({
        studentId: student.studentId,
        studentName: student.studentName,
        cohort: student.cohort,
        avgScore: Math.round(student.scores.reduce((a, b) => a + b, 0) / student.scores.length),
        completionRate: Math.round((student.completedCount / student.totalCount) * 100),
        totalTimeSpent: student.totalMinutes,
        totalActivities: student.totalCount
    }));

    leaderboard.sort((a, b) => b.avgScore - a.avgScore || b.completionRate - a.completionRate);
    leaderboard.forEach((student, index) => { student.rank = index + 1; });

    res.json({ leaderboard: leaderboard.slice(0, parseInt(limit)), total: leaderboard.length });
};

exports.getRecommendation = (req, res) => {
    const { studentId } = req.params;
    const data = loadData();
    const studentRecords = data.filter(r => r.studentId === studentId);

    if (studentRecords.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Student not found' });
    }

    const modules = {};
    studentRecords.forEach(r => {
        if (!modules[r.module]) modules[r.module] = { scores: [], times: [] };
        modules[r.module].scores.push(r.score);
        modules[r.module].times.push(r.durationMinutes);
    });

    const recommendations = [];
    Object.entries(modules).forEach(([module, data]) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const avgTime = data.times.reduce((a, b) => a + b, 0) / data.times.length;

        if (avgScore < 70 && avgTime < 30) {
            recommendations.push({ type: 'focus', module, reason: 'Low score & low time spent', priority: 'high' });
        } else if (avgScore < 75) {
            recommendations.push({ type: 'practice', module, reason: 'Need more practice to improve', priority: 'medium' });
        }
    });

    res.json({
        studentId,
        recommendations,
        strengths: Object.entries(modules).filter(([_, data]) => data.scores.reduce((a, b) => a + b, 0) / data.scores.length >= 85).map(([module]) => module)
    });
};
