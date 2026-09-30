/** .secrets CSV → .xlsx (bir martalik yordamchi). Parollarni chop etmaydi. */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

function csvOqi(yol: string): string[][] {
  const matn = readFileSync(yol, 'utf-8').replace(/^﻿/, '')
  return matn.split('\r\n').filter(Boolean).map((qator) => {
    // oddiy ; ajratuvchi (bizning fayllarda tirnoq yo'q)
    return qator.split(';')
  })
}

function yoz(csvYol: string, xlsxYol: string, varaq: string) {
  const rows = csvOqi(csvYol)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 8 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, varaq)
  XLSX.writeFile(wb, xlsxYol)
  console.log(`${xlsxYol}  (${rows.length - 1} qator)`)
}

yoz('.secrets/ustozlar-hisob.csv', '.secrets/ustozlar-hisob.xlsx', 'Ustozlar')
yoz('.secrets/oquvchilar-hisob.csv', '.secrets/oquvchilar-hisob.xlsx', 'Oquvchilar')
