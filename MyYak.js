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

// /data_2/ace_pill/database/ 폴더 내의 파일들을 공개
app.use('/images', express.static('/data_2/ace_pill/database/'));

app.use(bodyParser.json());
app.use(express.json());

// MongoDB 연결
mongoose.connect('mongodb://jihoon:jihoon@192.168.0.166:27017/')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// 히스토리 스키마
const HistorySchema = new mongoose.Schema({
    uploadDateTime: { type: Date, default: Date.now }, // 업로드 날짜 및 시간
    drugs: [{
        id: { type: mongoose.Schema.Types.Mixed }, // 약제 ID (1부터 n까지의 순차적인 번호)
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


// 파일 메타데이터 스키마 및 모델
const FileSchema = new mongoose.Schema({
    filename: String,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
});
const File = mongoose.model('MyYak_File', FileSchema);

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
});

const ResultSchema = new mongoose.Schema({
    id: String,
    path: String,
    candidates: [CandidateSchema]
});

const PredictionSchema = new mongoose.Schema({
    original_image: String,
    bounding_box_image: String,
    results: [ResultSchema],
    image_paths: [String] // 이미지 경로를 저장할 공간 추가
}, { collection: 'MyYak_Result' });

const Prediction = mongoose.model('Prediction', PredictionSchema);

// 사용자 스키마 및 모델
const UserSchema = new mongoose.Schema({
    username: String,
    password: String
});
const User = mongoose.model('MyYak_User', UserSchema);

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

// 히스토리 등록 API
app.post('/api/history_post', async(req, res) => {
    try {
        const { uploadDateTime, drugs } = req.body;

        // 요청 데이터의 유효성 검사
        if (!uploadDateTime || !drugs || !Array.isArray(drugs) || drugs.length === 0) {
            return res.status(400).json({ message: 'Invalid request data' });
        }

        // 히스토리 생성
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