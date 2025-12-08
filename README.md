# Face Auth Library by Code Web Khong Kho

Thư viện xác thực khuôn mặt thông minh, hỗ trợ tiếng Việt.  
Dùng để tích hợp xác thực khuôn mặt cho các sản phẩm web (KYC, check-in, chấm công, v.v.).

---

## 📦 Cài đặt

### 1️⃣ CDN

```html
<!-- Face Auth Library (bundle) -->
<script src="https://cdn.jsdelivr.net/npm/face-auth-library@latest/dist/face-auth.min.js"></script>
```

Sử dụng với HTML thuần:

```html
<button id="openFaceAuth">Mở camera xác thực</button>

<script>
  // Khởi tạo instance
  const faceAuth = new FaceAuth({
    detectionConfidence: 0.8,
    maxFaces: 1
  });

  document.getElementById('openFaceAuth').addEventListener('click', async () => {
    // Khởi tạo model
    await faceAuth.init();

    // Thực hiện xác thực
    const result = await faceAuth.authenticate();

    if (result.isAuthenticated) {
      alert('Xác thực thành công!');
    } else {
      alert('Xác thực thất bại, vui lòng thử lại.');
    }
  });
</script>
```

---

### 2️⃣ NPM

```bash
npm install face-auth-library
```

Sử dụng trong project (React, Vue, Next.js, Vite, Webpack, v.v.):

```javascript
import { FaceAuth } from 'face-auth-library';

// Khởi tạo
const faceAuth = new FaceAuth({
  detectionConfidence: 0.8,
  maxFaces: 1
});

async function handleFaceAuth() {
  // Khởi tạo model
  await faceAuth.init();

  // Thực hiện xác thực
  const result = await faceAuth.authenticate();

  if (result.isAuthenticated) {
    console.log('Xác thực thành công!');
  } else {
    console.log('Xác thực thất bại!');
  }
}
```

---

## 🚀 Ví dụ tích hợp nhanh (HTML thuần)

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Demo Face Auth</title>
</head>
<body>
  <button id="openFaceAuth">Mở camera xác thực</button>
  
  <!-- Face Auth Library -->
  <script src="https://cdn.jsdelivr.net/npm/face-auth-library@latest/dist/face-auth.min.js"></script>

  <script>
    const faceAuth = new FaceAuth({
      detectionConfidence: 0.8,
      maxFaces: 1
    });

    document
      .getElementById('openFaceAuth')
      .addEventListener('click', async () => {
        await faceAuth.init();
        const result = await faceAuth.authenticate();

        if (result.isAuthenticated) {
          alert('Xác thực thành công!');
        } else {
          alert('Xác thực thất bại, vui lòng thử lại.');
        }
      });
  </script>
</body>
</html>
```

---

## 🧠 API Reference

### `FaceAuth(options)`

Khởi tạo một đối tượng **FaceAuth**.

```javascript
const faceAuth = new FaceAuth(options);
```

**Tham số `options` (Object, optional):**

- `detectionConfidence` (**number**)  
  Ngưỡng tin cậy khi phát hiện khuôn mặt (0 → 1, ví dụ `0.8`).

- `maxFaces` (**number**)  
  Số lượng khuôn mặt tối đa cần xử lý (thường là `1` cho xác thực người dùng).

**Ví dụ:**

```javascript
const faceAuth = new FaceAuth({
  detectionConfidence: 0.85,
  maxFaces: 1
});
```

---

### `await faceAuth.init()`

Khởi tạo model, camera và các tài nguyên cần thiết.  
Bắt buộc phải gọi **trước** khi `authenticate()`.

```javascript
await faceAuth.init();
```

**Trả về:**  
`Promise<void>`

---

### `const result = await faceAuth.authenticate()`

Thực hiện quy trình xác thực khuôn mặt:

1. Mở camera.
2. Phát hiện khuôn mặt.
3. Kiểm tra vị trí, điều kiện.
4. Trả về kết quả xác thực.

```javascript
const result = await faceAuth.authenticate();

if (result.isAuthenticated) {
  console.log('Xác thực thành công!');
} else {
  console.log('Xác thực thất bại!', result.reason);
}
```

**Trả về:**  
```ts
type FaceAuthResult = {
  isAuthenticated: boolean; // true nếu xác thực thành công
  // Có thể mở rộng thêm:
  // imageBlob?: Blob;    // ảnh khuôn mặt đã chụp
  // reason?: string;     // lý do thất bại (nếu có)
};
```

---

## ✅ Tóm tắt

- Hỗ trợ:
  - CDN (nhúng trực tiếp vào HTML)
  - NPM (dùng trong các project build bằng bundler)
- API đơn giản:
  - `new FaceAuth(options)`
  - `await faceAuth.init()`
  - `await faceAuth.authenticate()`
- Tối ưu cho:
  - Xác thực người dùng (KYC)
  - Check-in, chấm công
  - Kiosk, hệ thống doanh nghiệp
