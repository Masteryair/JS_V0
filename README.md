# איקס אדלר – הוראות התקנה

## 1) יצירת פרויקט Firebase
1. היכנס ל־Firebase Console וצור פרויקט חדש.
2. הוסף אפליקציית Web והעתק את פרטי ההגדרה (config).
3. עבור ל־Realtime Database ופתח מסד נתונים.

## 2) הדבקת פרטי החיבור
פתח את [app.js](app.js) והחלף את הערכים של `firebaseConfig`:

- `apiKey`
- `authDomain`
- `databaseURL`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

## 3) כללי אבטחה בסיסיים (לפיתוח)
ב־Realtime Database Rules אפשר לשים זמנית:

```
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

לאחר מכן אפשר להקשיח לפי צורך.

## 4) העלאה ל־GitHub Pages
1. העלה את כל הקבצים לריפו.
2. הפעל GitHub Pages על branch הראשי.
3. היכנס לקישור – ותוכל לשחק.

בהצלחה!
