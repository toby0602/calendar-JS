# 行政院人事行政總處辦公日曆表來源

資料集：[中華民國政府行政機關辦公日曆表](https://data.gov.tw/dataset/14718)，提供機關為行政院人事行政總處，授權為[政府資料開放授權條款第 1 版](https://data.gov.tw/license)。專案於 2026-09-16 取得下列官方 CSV，僅將 2025 年 Big5 原檔轉為 UTF-8，未改動日期或休假欄位。

- `dgpa-2025.csv`：[114 年修正版（1141020 更新）](https://www.dgpa.gov.tw/FileConversion?filename=dgpa%2Ffiles%2F202510%2Fb84cb88a-803c-4621-a843-d637b2775615.csv&name=114%E5%B9%B4%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E6%94%BF%E5%BA%9C%E8%A1%8C%E6%94%BF%E6%A9%9F%E9%97%9C%E8%BE%A6%E5%85%AC%E6%97%A5%E6%9B%86%E8%A1%A8%281141020%E6%9B%B4%E6%96%B0%29.csv&nfix=)
- `dgpa-2026.csv`：[115 年](https://www.dgpa.gov.tw/FileConversion?filename=dgpa%2Ffiles%2F202506%2Fa52331bd-a189-466b-b0f0-cae3062bbf74.csv&name=115%E5%B9%B4%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E6%94%BF%E5%BA%9C%E8%A1%8C%E6%94%BF%E6%A9%9F%E9%97%9C%E8%BE%A6%E5%85%AC%E6%97%A5%E6%9B%86%E8%A1%A8.csv&nfix=)
- `dgpa-2027.csv`：[116 年](https://www.dgpa.gov.tw/FileConversion?filename=dgpa%2Ffiles%2F202607%2Ff538b1ff-ba60-4c63-9477-10db8e6612d1.csv&name=116%E5%B9%B4%E4%B8%AD%E8%8F%AF%E6%B0%91%E5%9C%8B%E6%94%BF%E5%BA%9C%E8%A1%8C%E6%94%BF%E6%A9%9F%E9%97%9C%E8%BE%A6%E5%85%AC%E6%97%A5%E6%9B%86%E8%A1%A8_utf8bom.csv&nfix=)

CSV 的「是否放假」欄位中，`2` 表示放假，`0` 表示上班。`js/holidays.js` 由 `node scripts/build-holidays.cjs` 產生，包含完整年度中的休假日與週末補行上班日。
