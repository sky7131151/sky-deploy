# sky-deploy

一款使用ftp自动部署代码的工具，上传错误会自动列出并重传，确保百分百部署成功，有进度条清晰展示部署进度



# 必要配置

项目根目录新建 sky-deploy.js，内容如下：

```js
const deploy = require('sky-deploy').deploy

const config_kemanfang = {
    host: '',
    port: '21',
    user: '',  
    password: '',

    del_ignore_dir_arr: [],
    del_ignore_file_arr: [],
    upload_dir: ''  //所部署目录的绝对地址

}

deploy(config_kemanfang)

```

上面配置好后，在package.json中配置 "sky-build-deploy" 和 "sky-deploy"，内容如下：

```
  "scripts": {
    "analyze": "source-map-explorer build/static/js/main.*",
    "start": "node scripts/start.js",
    "build": "node scripts/build.js",
    "sky-build-deploy": "node scripts/build.js && node sky-deploy",
    "sky-deploy": "node sky-deploy",
    "test": "node scripts/test.js"
  },
```

# 使用

npm run sky-build-deploy  命令     将会先打包再自动发布 

npm run sky-deploy 命令                将会直接发布对应文件

# 注意
若ftp连接成功，但获取远程文件列表失败，请检查服务器对ftp的被动端口范围 39000-40000有无放行！