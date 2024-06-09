const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const app = express();
const port = 3000;

// /data_2/ace_pill/database/ 폴더 내의 파일 공개 전환
app.use('/images', express.static('/data_2/ace_pill/database/'));

app.use(bodyParser.json());
app.use(express.json());

// 서버 사이드 MongoDB 연결
mongoose.connect('mongodb://jihoon:jihoon@192.168.0.166:27017/')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// 히스토리 스키마
const HistorySchema = new mongoose.Schema({
    uploadDateTime: { type: Date, default: Date.now },
    drugs: [{
        id: { type: mongoose.Schema.Types.Mixed },
        class: { type: mongoose.Schema.Types.Mixed },
        percentage: { type: mongoose.Schema.Types.Mixed },
        name: { type: mongoose.Schema.Types.Mixed },
        image: { type: mongoose.Schema.Types.Mixed },
        material: { type: mongoose.Schema.Types.Mixed },
        description: { type: mongoose.Schema.Types.Mixed },
        type: { type: mongoose.Schema.Types.Mixed },
        code: { type: mongoose.Schema.Types.Mixed },
        company: { type: mongoose.Schema.Types.Mixed }
    }]
});
const History = mongoose.model('MyYak_History', HistorySchema);

// 파일 메타데이터 스키마
const FileSchema = new mongoose.Schema({
    filename: String,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
});
const File = mongoose.model('MyYak_File', FileSchema);

// Top-5 후보 약제 스키마
const CandidateSchema = new mongoose.Schema({
    id: String,
    class: String,
    rank: Number,
    percentage: String,
    name: String,
    image: String,
    material: String,
    description: String,
    type: String,
    code: String,
    company: String
})

// 결과 정보 스키마 
const ResultSchema = new mongoose.Schema({
    id: String,
    path: String,
    candidates: [CandidateSchema]
});

// 예측 결과 스키마(원본 이미지 정보 포함)
const PredictionSchema = new mongoose.Schema({
    original_image: String,
    bounding_box_image: String,
    results: [ResultSchema],
    image_paths: [String]
}, { collection: 'MyYak_Result' });

const Prediction = mongoose.model('Prediction', PredictionSchema);

// 사용자 스키마 
const UserSchema = new mongoose.Schema({
    username: String,
    password: String
});
const User = mongoose.model('MyYak_User', UserSchema);

// 파이썬 모델 실행 스크립트
const runPythonScript = (filePath) => {
    return new Promise((resolve, reject) => {
        exec('git config --global --add safe.directory /data_2/ace_jungmin/yolov5', (gitErr, gitStdout, gitStderr) => {
            if (gitErr) {
                console.error(`git config error: ${gitStderr}`);
                return reject(gitErr);
            }

            const scriptPath = '/data_2/ace_pill/crop_and_classify6.py';
            const process = spawn('python3', [scriptPath, filePath]);

            process.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });

            process.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Process exited with code ${code}`));
                }
                resolve();
            });
        });
    });
};

// 리눅스 서버 저장용 스크립트
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });


// 회원가입 API
app.post('/api/auth/signup', async(req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.json({ message: 'Signup successful', userId: newUser.username });
});

// 로그인 API
app.post('/api/auth/login', async(req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).send({ message: 'Login failed' });
    }
    const token = jwt.sign({ userId: user._id }, 'your_jwt_secret');
    res.json({ message: 'Login successful', token });
});

// 이미지 업로드 및 모델 실행, 결과 보여주기 API
app.post('/api/upload', upload.single('image'), async(req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        console.log('File uploaded', req.file);

        const newFile = new File({
            filename: req.file.filename,
            path: req.file.path
        });

        await newFile.save();

        await runPythonScript(req.file.path);

        const jsonFilePath = path.join('/data_2/ace_pill/database/output_latest/results.json');
        const predictionData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

        const outputDirMatch = predictionData.original_image.match(/output_(\d+)/);
        if (!outputDirMatch) {
            throw new Error('Invalid original image path format');
        }
        const outputDirNumber = outputDirMatch[1];
        const outputDir = path.join('/data_2/ace_pill/database', `output_${outputDirNumber}`);

        console.log(`Extracted number from path: ${outputDirNumber}`);

        const destImagePath = path.join(outputDir, `uploaded_image.png`);
        fs.renameSync(req.file.path, destImagePath);

        const imagePaths = predictionData.results.map((result, index) => {
            return `http://192.168.0.166:3000/images/output_${outputDirNumber}/pill_image_${index}.png`;
        });

        imagePaths.push(`http://192.168.0.166:3000/images/output_${outputDirNumber}/uploaded_image.png`);
        imagePaths.push(`http://192.168.0.166:3000/images/output_${outputDirNumber}/bounding_box_pill_image.png`);

        const newPrediction = new Prediction({
            original_image: predictionData.original_image,
            bounding_box_image: predictionData.bounding_box_image,
            results: predictionData.results,
            image_paths: imagePaths
        });

        await newPrediction.save();

        res.json({ message: 'Uploaded and processed successfully', prediction: newPrediction });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ message: 'File processing failed', error: error.message });
    }

});


// 히스토리 등록 API
app.post('/api/history_post', async(req, res) => {
    try {
        const { uploadDateTime, drugs } = req.body;

        if (!uploadDateTime || !drugs || !Array.isArray(drugs) || drugs.length === 0) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        const history = new History({ uploadDateTime, drugs });
        await history.save();

        res.status(201).json({ message: 'History created successfully', history });
    } catch (error) {
        console.error('Error creating history:', error);
        res.status(500).json({ message: 'Failed to create history', error: error.message });
    }
});

// 히스토리 호출 API
app.get('/api/history_get', async(req, res) => {
    try {
        const history = await History.find();
        res.json(history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ message: 'Failed to fetch history', error: error.message });
    }
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});