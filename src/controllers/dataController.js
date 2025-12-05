const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');

const DATA_FILE = path.join(__dirname, '../data/dummy.json');

const loadData = () => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const saveData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

exports.getSample = (req, res) => {
    const data = loadData();
    res.json({ status: 'success', count: data.length, data: data.slice(0, 10) });
};

const upload = multer({ dest: 'uploads/' });

exports.importData = [
    upload.single('file'),
    async (req, res) => {
        if (req.file) {
            const results = [];
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    saveData(results);
                    fs.unlinkSync(req.file.path);
                    res.json({ status: 'success', imported: results.length });
                });
        } else if (req.body.data) {
            const data = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
            saveData(data);
            res.json({ status: 'success', imported: data.length });
        } else {
            res.status(400).json({ status: 'error', message: 'No data provided' });
        }
    }
];

exports.getRecords = (req, res) => {
    const { start, end, cohort, module, limit = 100, offset = 0 } = req.query;
    let data = loadData();

    if (start) data = data.filter(r => new Date(r.date) >= new Date(start));
    if (end) data = data.filter(r => new Date(r.date) <= new Date(end));
    if (cohort) data = data.filter(r => r.cohort === cohort);
    if (module) data = data.filter(r => r.module === module);

    const total = data.length;
    const paginatedData = data.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({ status: 'success', total, limit: parseInt(limit), offset: parseInt(offset), data: paginatedData });
};
