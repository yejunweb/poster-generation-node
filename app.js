const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

class PosterGenerator {
    constructor() {
        this.browser = null
        this.templateDir = path.join(__dirname, 'templates')
        this.outputDir = path.join(__dirname, 'output')
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
    }

    async generate(templateName, data, outputFileName) {
        const page = await this.browser.newPage()

        // 读取HTML模板
        const htmlPath = path.join(this.templateDir, `${templateName}.html`)
        let html = fs.readFileSync(htmlPath, 'utf-8')

        // 替换模板变量
        html = this.replaceTemplateVariables(html, data)

        // 设置HTML内容
        await page.setContent(html, { waitUntil: 'networkidle0' })

        // 设置视口
        await page.setViewport({ width: 750, height: 1334 })

        // 截图
        const screenshot = await page.screenshot({
            type: 'jpeg',
            quality: 90,
            fullPage: false,
        })

        await page.close()

        // 确保输出目录存在
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true })
        }

        // 生成输出文件名
        const fileName = outputFileName || `${templateName}-${Date.now()}.jpg`
        const outputPath = path.join(this.outputDir, fileName)

        // 保存图片到本地
        fs.writeFileSync(outputPath, screenshot)

        console.log(`图片已保存到: ${outputPath}`)
        return outputPath
    }

    replaceTemplateVariables(html, data) {
        let result = html

        // 处理格式化函数 formatPrice
        result = result.replace(
            /\{\{formatPrice\s+(\w+)\}\}/g,
            (match, key) => {
                const value = data[key] || 0
                // 格式化价格：每3位数字加一个逗号
                return (
                    value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
                    '万'
                )
            }
        )

        // 处理条件语句 {{#if hasParking}}...{{/if}}
        result = result.replace(
            /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
            (match, key, content) => {
                if (data[key]) {
                    // 递归处理内容中的变量
                    return this.replaceTemplateVariables(content, data)
                }
                return ''
            }
        )

        // 处理条件比较 {{#ifCond taxFree '==' 'true'}}...{{/ifCond}}
        result = result.replace(
            /\{\{#ifCond\s+(\w+)\s+('==='?|'!=='?|'=='|'!=')\s+('.*?'|".*?"|\w+)\}\}([\s\S]*?)\{\{\/ifCond\}\}/g,
            (match, key, operator, value, content) => {
                const dataValue = data[key]
                const compareValue = value.replace(/['"]/g, '') // 移除引号
                let condition = false

                if (operator === "'=='" || operator === "'==='") {
                    condition = String(dataValue) === compareValue
                } else if (operator === "'!='" || operator === "'!==") {
                    condition = String(dataValue) !== compareValue
                }

                if (condition) {
                    return this.replaceTemplateVariables(content, data)
                }
                return ''
            }
        )

        // 简单的模板变量替换
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
            result = result.replace(regex, value)
        }

        return result
    }

    async close() {
        if (this.browser) {
            await this.browser.close()
        }
    }
}

module.exports = PosterGenerator

const posterGenerator = new PosterGenerator()

// 模拟房源数据
const mockHouseData = {
    price: 268, // 总价（万元）
    area: 89, // 面积（平米）
    gift: 15, // 赠送面积（平米）
    layout: '3室2厅3室', // 户型
    decoration: '精装', // 装修
    hasParking: true, // 是否有车位
    parkingPrice: 25, // 车位价格（万元）
    extraArea: 12, // 附加面积（平米）
    floor: '15/30', // 楼层
    taxFree: 'true', // 是否免税
}

;(async () => {
    await posterGenerator.init()
    await posterGenerator.generate('house-poster', mockHouseData)
    await posterGenerator.close()
})()
