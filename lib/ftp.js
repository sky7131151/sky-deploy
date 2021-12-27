const Client = require('ftp');
const fs = require('fs');
const slog = require('single-line-log').stdout;

async function deploy(config) {
    const c = Client();
    console.time('连接ftp耗时')
    console.time('总计耗时')
    console.log('ftp连接中...')
    try {
        await connect(c, config)
    } catch (err) {
        console.log('ftp连接失败：',err);
        process.exit()
    }
    console.timeEnd('连接ftp耗时')

    let upload_dir = config.upload_dir
    let del_ignore_dir_arr = config.del_ignore_dir_arr
    let del_ignore_file_arr = config.del_ignore_file_arr

    del_ignore_dir_arr = [
        ...del_ignore_dir_arr,
        '.', '..'
    ]

    console.log('远程忽略删除文件夹:', del_ignore_dir_arr)
    console.log('远程忽略删除文件:', del_ignore_file_arr)

    let should_del_dir = [
        // {
        //     path: '',
        //     status: 0,   //0：未上传  1:已上传  2:上传出错
        //     err: null
        // }
    ]

    let should_del_file = [
        // {
        //     path: '',
        //     status: 0,   //0：未上传  1:已上传  2:上传出错
        //     err: null
        // }
    ]

    let should_upload_dir = [
        // {
        //     path: '',
        //     status: 0,   //0：未上传  1:已上传  2:上传出错
        //     err: null
        // }
    ]

    let should_upload_file = [
        // {
        //     loacal_path: '',
        //     remote_path: '',
        //     status: 0,   //0：未上传  1:已上传  2:上传出错
        //     err: null
        // }
    ]

    let rs

    //获取本地文件信息
    get_local_file_msg()

    //获取远程应该删除的文件夹和文件信息
    try {
        await get_remote_del_msg()
    } catch (err) {
        console.log('get_remote_del_msg_err:', err)
        console.log('ftp连接成功，但获取远程文件列表失败，请检查服务器对ftp的被动端口范围 39000-40000有无放行！')
        process.exit()
    }

    console.log('应该删除的远程文件夹：', should_del_dir.map((item) => {
        return item.path
    }))
    console.log('应该删除的一级远程文件数量：', should_del_file.length)
    console.log('应该远程创建的文件夹：', should_upload_dir.map((item) => {
        return item.path
    }))
    console.log('应该上传的文件数量：', should_upload_file.length)
    // return;

    //删除远程文件夹
    console.time('删除远程文件夹耗时')
    await del_remote_dir()
    slog.clear()
    console.timeEnd('删除远程文件夹耗时')


    //删除远程文件
    console.time('删除远程文件耗时')
    await del_remote_file()
    slog.clear()
    console.timeEnd('删除远程文件耗时')

    //远程创建文件夹
    console.time('远程创建文件夹耗时')
    await upload_remote_dir()
    slog.clear()
    console.timeEnd('远程创建文件夹耗时')

    //上传文件
    console.time('上传文件耗时')
    await upload_remote_file()
    slog.clear()
    console.timeEnd('上传文件耗时')


    console.log('部署完成')
    console.timeEnd('总计耗时')
    process.exit()


    //获取本地文件信息
    function get_local_file_msg() {
        if (!fs.existsSync(upload_dir)) {
            console.log('上传文件夹不存在:', upload_dir)
            return false;
        }

        function digui(read_dir) {
            let path = fs.readdirSync(read_dir)
            path.forEach((item) => {
                let file_path = read_dir + "/" + item
                let file_info = fs.statSync(file_path)
                if (file_info.isDirectory()) {
                    let remote_dir = file_path.split(upload_dir)[1]
                    should_upload_dir.push({
                        path: remote_dir,
                        status: 0,
                        err: null
                    })
                    digui(file_path)
                } else {
                    let remote_file = file_path.split(upload_dir)[1]
                    should_upload_file.push({
                        loacal_path: file_path,
                        remote_path: remote_file,
                        status: 0,
                        err: null
                    })
                }
            })
        }
        digui(upload_dir)
    }

    //获取服务器要删除的文件信息
    function get_remote_del_msg() {
        return new Promise((resolve, reject) => {

            c.list(function (err, list) {
                if (err) {
                    reject(err)
                    return
                }
                for (let item of list) {
                    if (item.type === 'd' && del_ignore_dir_arr.includes(item.name)) {
                        continue
                    }
                    if (item.type === '-' && del_ignore_file_arr.includes(item.name)) {
                        continue
                    }
                    if (item.type === 'd') {
                        should_del_dir.push({
                            path: item.name,
                            status: 0,
                            err: null
                        })
                    }
                    if (item.type === '-') {
                        should_del_file.push({
                            path: item.name,
                            status: 0,
                            err: null
                        })
                    }
                }
                resolve(true)
            })
        })
    }

    //删除远程文件夹
    async function del_remote_dir() {
        let pb = new ProgressBar('删除远程文件夹中', 50);

        for (let i = 0, ilen = should_del_dir.length; i < ilen; i++) {
            let status = should_del_dir[i].status
            if (status == 0 || status == 2) {
                let completed = should_del_dir.reduce((total, item) => {
                    let val = 0
                    if (item.status == 1) {
                        val = 1
                    }
                    return total + val
                }, 0)
                let total = ilen
                pb.render({ completed, total, des: should_del_dir[i].path });
                try {
                    await rmdir(should_del_dir[i])
                    should_del_dir[i].status = 1
                } catch (err) {
                    should_del_dir[i].status = 2
                    should_del_dir[i].err = err
                }
                completed = should_del_dir.reduce((total, item) => {
                    let val = 0
                    if (item.status == 1) {
                        val = 1
                    }
                    return total + val
                }, 0)
                pb.render({ completed, total });
            }
        }
        let err_list = should_del_dir.filter((item) => {
            return item.status == 2
        })
        if (err_list.length > 0) {
            // await del_remote_dir()
            slog.clear()
            console.log('del_remote_dir_err:', err_list)
            process.exit()
        }

        function rmdir(item) {
            return new Promise((resolve, reject) => {
                c.rmdir(item.path, true, (err) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve()
                })
            })
        }
    }

    //删除远程文件
    async function del_remote_file() {
        let pb = new ProgressBar('删除远程文件', 50);
        for (let i = 0, ilen = should_del_file.length; i < ilen; i++) {
            let status = should_del_file[i].status
            if (status == 0 || status == 2) {
                let completed = should_del_file.reduce((total, item) => {
                    let val = 0
                    if (item.status == 1) {
                        val = 1
                    }
                    return total + val
                }, 0)
                let total = ilen
                pb.render({ completed, total, des: should_del_file[i].path });
                try {
                    await delete_file(should_del_file[i])
                    should_del_file[i].status = 1
                } catch (err) {
                    should_del_file[i].status = 2
                    should_del_file[i].err = err
                }
                completed = should_del_file.reduce((total, item) => {
                    let val = 0
                    if (item.status == 1) {
                        val = 1
                    }
                    return total + val
                }, 0)
                pb.render({ completed, total });
            }
        }
        let err_list = should_del_file.filter((item) => {
            return item.status == 2
        })
        if (err_list.length > 0) {
            // await del_remote_dir()
            slog.clear()
            console.log('del_remote_file_err:', err_list)
            process.exit()
        }

        function delete_file(item) {
            return new Promise((resolve, reject) => {
                c.delete(item.path, (err) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve()
                })
            })
        }
    }

    //远程创建文件夹
    async function upload_remote_dir() {
        let pb = new ProgressBar('创建远程文件夹', 50);
        for (let i = 0, ilen = should_upload_dir.length; i < ilen; i++) {
            let status = should_upload_dir[i].status
            if (status == 0 || status == 2) {
                let completed = should_upload_dir.reduce((total, item) => {
                    let val = 0
                    if (item.status == 1) {
                        val = 1
                    }
                    return total + val
                }, 0)
                let total = ilen
                pb.render({ completed, total, des: should_upload_dir[i].path });
                try {
                    await create_dir(should_upload_dir[i])
                    should_upload_dir[i].status = 1
                } catch (err) {
                    should_upload_dir[i].status = 2
                    should_upload_dir[i].err = err
                }
                completed = should_upload_dir.reduce((total, item) => {
                    let val = 0
                    if (item.status == 1) {
                        val = 1
                    }
                    return total + val
                }, 0)
                pb.render({ completed, total });
            }
        }
        let err_list = should_upload_dir.filter((item) => {
            return item.status == 2
        })
        if (err_list.length > 0) {
            slog.clear()
            console.log('upload_remote_dir_err:', err_list)
            process.exit()
        }

        function create_dir(item) {
            return new Promise((resolve, reject) => {
                c.mkdir(item.path, true, (err) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve()
                })
            })
        }
    }
    //上传文件
    async function upload_remote_file(title = "上传文件") {
        for (let i = 0, ilen = should_upload_file.length; i < ilen; i++) {
            let status = should_upload_file[i].status
            if (status == 0 || status == 2) {
                let completed = should_upload_file.reduce((total, item) => {
                    let val = 0
                    if (item.status == 1) {
                        val = 1
                    }
                    return total + val
                }, 0)
                let total = ilen
                let pb = new ProgressBar(title, 25);
                pb.render({ completed, total, des: should_upload_file[i].remote_path });
                try {
                    await upload_file(should_upload_file[i])
                    should_upload_file[i].status = 1
                } catch (err) {
                    should_upload_file[i].status = 2
                    should_upload_file[i].err = err
                }
                completed = should_upload_file.reduce((total, item) => {
                    let val = 0
                    if (item.status == 1) {
                        val = 1
                    }
                    return total + val
                }, 0)
                pb = new ProgressBar(title, 25);
                pb.render({ completed, total });
            }
        }
        let err_list = should_upload_file.filter((item) => {
            return item.status == 2
        })
        if (err_list.length > 0) {
            slog.clear()
            console.log('upload_remote_file_err:', err_list)
            await upload_remote_file('重传文件')
            // process.exit()
        }

        function upload_file(item) {
            return new Promise((resolve, reject) => {
                c.put(item.loacal_path, item.remote_path, (err) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve()
                })
            })
        }
    }
}

function connect(c, config) {
    return new Promise((resolve, reject) => {
        c.on('ready', () => {
            console.log('ftp连接成功!')
            resolve();
        })
        c.on('close', () => {
            console.log('ftp close');
        });
        c.on('end', () => {
            console.log('ftp end');
        });
        c.on('error', (err) => {
            reject(err)
        });

        c.connect(config);
    })
}


function ProgressBar(description, bar_length) {
    // 两个基本参数(属性)
    this.description = description || 'Progress';       // 命令行开头的文字信息
    this.length = bar_length || 25;                     // 进度条的长度(单位：字符)，默认设为 25
    this.clear = slog.clear
    // 刷新进度条图案、文字的方法
    this.render = function (opts) {
        var percent = (opts.completed / opts.total).toFixed(4);    // 计算进度(子任务的 完成数 除以 总数)
        var cell_num = Math.floor(percent * this.length);             // 计算需要多少个 █ 符号来拼凑图案

        // 拼接黑色条
        var cell = '';
        for (var i = 0; i < cell_num; i++) {
            cell += '#';
        }

        // 拼接灰色条
        var empty = '';
        for (var i = 0; i < this.length - cell_num; i++) {
            empty += '-';
        }
        let des = opts.des ? opts.des : ''

        // 拼接最终文本
        var cmdText = this.description + ': ' + (100 * percent).toFixed(2) + '% ' + cell + empty + ' ' + opts.completed + '/' + opts.total + " " + des;

        // 在单行输出文本
        slog(cmdText);
    };
}


exports.deploy = deploy
