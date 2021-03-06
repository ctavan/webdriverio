import path from 'path'
import fs from 'fs-extra'
import Selenium from 'selenium-standalone'
import SeleniumStandaloneLauncher from '../src/launcher'

jest.mock('fs-extra', () => ({
    createWriteStream : jest.fn(),
    ensureFileSync : jest.fn(),
}))

describe('Selenium standalone launcher', () => {
    beforeEach(() => {
        Selenium.install.mockClear()
        Selenium.start.mockClear()
    })

    describe('onPrepare', () => {
        test('should set correct config properties', async () => {
            const options = {
                logPath : './',
                args : { foo : 'foo' },
                installArgs : { bar : 'bar' },
            }
            const capabilities = [{ port: 1234 }]
            const launcher = new SeleniumStandaloneLauncher(options, capabilities, {})
            launcher._redirectLogStream = jest.fn()
            await launcher.onPrepare({ watch: true })

            expect(launcher.logPath).toBe(options.logPath)
            expect(launcher.installArgs).toBe(options.installArgs)
            expect(launcher.args).toBe(options.args)
            expect(launcher.skipSeleniumInstall).toBe(false)
            expect(launcher.watchMode).toEqual(true)
            expect(capabilities[0].protocol).toBe('http')
            expect(capabilities[0].hostname).toBe('localhost')
            expect(capabilities[0].port).toBe(4444)
            expect(capabilities[0].path).toBe('/wd/hub')
        })

        test('should call selenium install and start', async () => {
            const options = {
                logPath : './',
                installArgs : {
                    version : '3.9.1',
                    baseURL : 'https://selenium-release.storage.googleapis.com',
                    drivers : {
                        chrome : {
                            version : '2.38',
                            arch : process.arch,
                            baseURL : 'https://chromedriver.storage.googleapis.com',
                        }
                    }
                },
                args: {
                    version : '3.9.1',
                    drivers : {
                        chrome : {
                            version : '2.38',
                        }
                    }
                }
            }
            const launcher = new SeleniumStandaloneLauncher(options, [], {})
            launcher._redirectLogStream = jest.fn()
            await launcher.onPrepare({})

            expect(Selenium.install.mock.calls[0][0]).toBe(options.installArgs)
            expect(Selenium.start.mock.calls[0][0]).toBe(options.args)
            expect(launcher._redirectLogStream).toBeCalled()
        })

        test('should skip selenium install', async () => {
            const options = {
                logPath : './',
                args: {
                    version : '3.9.1',
                    drivers : {
                        chrome : {
                            version : '2.38',
                        }
                    }
                },
                skipSeleniumInstall: true
            }
            const launcher = new SeleniumStandaloneLauncher(options, [], {})
            launcher._redirectLogStream = jest.fn()
            await launcher.onPrepare({})

            expect(Selenium.install).not.toBeCalled()
            expect(Selenium.start.mock.calls[0][0]).toBe(options.args)
            expect(launcher._redirectLogStream).toBeCalled()
        })

        test('should not output the log file', async () => {
            const launcher = new SeleniumStandaloneLauncher({
                installArgs : {},
                args : {},
            }, [], {})
            launcher._redirectLogStream = jest.fn()
            await launcher.onPrepare({})

            expect(launcher._redirectLogStream).not.toBeCalled()
        })

        test('should add exit listeners to kill process in watch mode', async () => {
            const processOnSpy = jest.spyOn(process, 'on')

            const launcher = new SeleniumStandaloneLauncher({
                installArgs : {},
                args : {}
            }, [], {})
            launcher._redirectLogStream = jest.fn()
            await launcher.onPrepare({ watch: true })

            expect(processOnSpy).toHaveBeenCalledWith('SIGINT', launcher._stopProcess)
            expect(processOnSpy).toHaveBeenCalledWith('exit', launcher._stopProcess)
            expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', launcher._stopProcess)
        })
    })

    describe('onComplete', () => {
        test('should call process.kill', async () => {
            const launcher = new SeleniumStandaloneLauncher({
                installArgs : {},
                args : {},
            }, [], {})
            launcher._redirectLogStream = jest.fn()
            await launcher.onPrepare({})
            launcher.onComplete()

            expect(launcher.process.kill).toBeCalled()
        })

        test('should not call process.kill', () => {
            const launcher = new SeleniumStandaloneLauncher({}, [], {})
            launcher.onComplete()

            expect(launcher.process).toBeFalsy()
        })

        test('should not call process.kill in watch mode', async () => {
            const launcher = new SeleniumStandaloneLauncher({
                installArgs : {},
                args : {}
            }, [], {})
            launcher._redirectLogStream = jest.fn()
            await launcher.onPrepare({ watch: true })
            launcher.onComplete()

            expect(launcher.process.kill).not.toBeCalled()
        })
    })

    describe('_redirectLogStream', () => {
        test('should write output to file', async () => {
            const launcher = new SeleniumStandaloneLauncher({
                logPath : './',
                installArgs : {},
                args : {},
            }, [], {})
            await launcher.onPrepare({})

            expect(fs.createWriteStream.mock.calls[0][0])
                .toBe(path.join(process.cwd(), 'wdio-selenium-standalone.log'))
            expect(launcher.process.stdout.pipe).toBeCalled()
            expect(launcher.process.stderr.pipe).toBeCalled()
        })
    })
})
