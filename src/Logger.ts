
interface ColorDefinition {
    color?: string
    background?: string
}

export enum LogLevel {
    DEBUG = 1,
    INFO = 2,
    IMPORTANT = 3,
    WARN = 4,
    ERROR = 5,
    CRITICAL = 6
}

export class Logger {
    private enabledFor: LogLevel

    constructor(
        name?: string
    ) {
        if(name) {
            this.enabledFor = Memory.config?.loggers[name] || LogLevel.DEBUG
        }
        else {
            this.enabledFor = LogLevel.DEBUG
        }
    }

    email(message: string, delay: number = 0) {
        let fullMessage = `[${Game.time}] ${message}`

        if(fullMessage.length > 996) {
            fullMessage = fullMessage.substring(0, 995) + '...'
        }

        Game.notify(fullMessage, delay)
    }

    info(...args: any[]) {
        this.doLog(LogLevel.INFO, {}, args)
    }

    debug(...args: any[]) {
        this.doLog(LogLevel.DEBUG, {
            color: 'gray'
        }, args)
    }

    important(...args: any[]) {
        this.doLog(LogLevel.IMPORTANT, {
            color: '#77a8f7'
        }, args)
    }

    error(...args: any[]) {
        this.doLog(LogLevel.ERROR, {
            color: 'red',
        }, args)
    }

    warn(...args: any[]) {
        this.doLog(LogLevel.WARN, {
            color: '#f0a64d',
        }, args)
    }

    critical(...args: any[]) {
        this.doLog(LogLevel.CRITICAL, {
            color: 'white',
            background: 'red'
        }, args)
    }

    private doLog(level: LogLevel, color: ColorDefinition, args: any[]) {
        if(level < this.enabledFor) {
            return
        }

        const colorStyle = `${color.color ? 'color:'+color.color : ''};${color.background ? 'background:'+color.background : ''}`
        const first = args.shift()
        console.log(`[<span style="color: gray">T:${Game.time}</span>] <span style="${colorStyle}">${first}</span>`, ...args)
    }
}
