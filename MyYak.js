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

// MongoDB 연결
mongoose.connect('mongodb://jihoon:jihoon@192.168.0.166:27017/')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

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

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});