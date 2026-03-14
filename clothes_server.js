const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

//이미지 폴더 자동생성
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, 'html')));
//이미지 저장 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '_' + file.originalname); }
});
const upload = multer({ storage: storage });

// MySQL 연결
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'dnrwkd#dl2030', 
    database: 'clothes_db'
});

//DB 연결 확인 로직
db.connect((err) => {
    if (err) {
        console.error('DB 연결 실패');
        console.error('사유:', err.message);
        return;
    }
    console.log('DB 연결 성공');
});

//옷 등록 API
app.post('/api/clothes', upload.single('image'), (req, res) => {
    //default 값
    const { 
        barcodeId, 
        name, 
        category = '미분류', 
        thickness = 1, 
        status = '보관', 
        memo = '', 
        location = '중앙 구역'
    } = req.body;
    
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const sql = `INSERT INTO clothes 
                (barcodeId, name, category, thickness, imagePath, status, washDate, memo, location) 
                VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?)`;
    
    const params = [barcodeId, name, category, thickness, imagePath, status, memo, location];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('DB 저장 에러:', err);
            // 바코드 중복 처리
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: '이미 등록된 바코드입니다.' });
            }
            return res.status(500).json({ error: '저장 실패' });
        }
        console.log(`등록 완료: ${name} (${barcodeId})`);
        res.json({ success: true, message: '옷이 성공적으로 등록되었습니다.' });
    });
});

//메인 페이지용 API: 바코드, 이름, 이미지, 메모
app.get('/api/clothes/main', (req, res) => {
    const sql = "SELECT barcodeId, name, imagePath, memo FROM clothes ORDER BY barcodeId DESC";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('메인 목록 조회 에러:', err);
            return res.status(500).json({ error: '목록 조회 실패' });
        }

        const processedResults = results.map(item => ({
            barcodeId: item.barcodeId,
            name: item.name,
            imagePath: item.imagePath ? item.imagePath : '/uploads/default_clothes.jpg',
            memo: item.memo
        }));

        console.log(`메인 목록 조회 완료: ${results.length}개의 옷`);
        res.json(processedResults);
    });
});

//메인 페이지용: 세부 정보(all)
app.get('/api/clothes/detail/:barcodeId', (req, res) => {
    const { barcodeId } = req.params;
    //해당 바코드의 모든 정보 조회
    const sql = 'SELECT barcodeId, name, category, thickness, imagePath, status, DATE_FORMAT(washDate, "%Y/%m/%d") AS washDate, memo FROM clothes WHERE barcodeId = ?';

    db.query(sql, [barcodeId], (err, results) => {
        if (err) {
            console.error('❌ 세부 정보 조회 에러:', err);
            return res.status(500).json({ error: '세부 정보 조회 실패' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: '해당 옷을 찾을 수 없습니다.' });
        }

        const item = results[0];
        const processedItem = {
            ...item,
            imagePath: item.imagePath ? item.imagePath : '/uploads/default_clothes.jpg'
        };

        console.log(`세부 정보 조회 완료: 바코드 ${barcodeId}`);
        res.json(processedItem);
    });
});

//옷 삭제
app.delete('/api/clothes/delete/:barcodeId', (req, res) => {
    const { barcodeId } = req.params;

    //해당 바코드를 가진 행 삭제
    const sql = "DELETE FROM clothes WHERE barcodeId = ?";

    db.query(sql, [barcodeId], (err, result) => {
        if (err) {
            console.error('삭제 에러:', err);
            return res.status(500).json({ error: '삭제 중 오류가 발생했습니다.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '삭제할 옷을 찾을 수 없습니다.' });
        }

        console.log(`삭제 완료: 바코드 ${barcodeId}`);
        res.json({ success: true, message: '옷이 성공적으로 삭제되었습니다.' });
    });
});

//옷 수정







const PORT = process.env.PORT || 3000;

// '0.0.0.0'을 넣어줘야 외부 접속을 제대로 받아들입니다.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});