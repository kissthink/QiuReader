var book = null; // 书籍

var tocSide = {
    isVisible: false
};

Object.defineProperty(tocSide, 'visible', {
    set: function (val) {
        this.isVisible = val;
        var tocSide = document.getElementsByClassName('toc-side')[0];
        !val ? tocSide.classList.add('off') : tocSide.classList.remove('off');
    }
});

// 进入页面后的一系列初始化操作
function init() {
    var key = document.cookie.split(';')[0].split('=')[1]; // 获取存储在 cookie 中的当前阅读书籍的 key
    console.log(key);

    bookDB.open(function () {
        bookDB.getBook(
            key,
            function (result) {
                var page = document.getElementsByClassName('page')[0];
                var option = {
                    bookPath: result.content,
                    restore: true
                };
                book = ePub(option);

                // 生成目录
                book.getToc().then(function (toc) {
                    var ul = generateToc(toc, false);
                    ul.classList.add('root-list'); // 'root-list' 用于标记根列表
                    document.getElementsByClassName('toc')[0].appendChild(ul);
                });

                // 设置样式
                book.setStyle('user-select', 'none'); // 禁用文字选择
                book.setStyle('background-color', 'transparent'); // 背景透明

                // 渲染
                book.renderTo(page);
            },
            function () {
                alert('获取书籍信息失败，请返回首页重试！');
            }
        );
    });
}

// 生成目录
function generateToc(chapters, collapse) {
    var ul = document.createElement('ul'),
        li,
        str = '<div class="item-content"><i class="item-mark"></i><a class="chapter-url" href="{url}">{label}</a></div>',
        itemContent;

    ul.className = collapse ? 'chapter-list collapse' : 'chapter-list expand';
    ul.style.height = collapse ? '0' : '';

    chapters.forEach(function (item) {
        li = document.createElement('li');
        li.className = 'chapter-list-item';
        itemContent = str.replace('{url}', item.href)
            .replace('{label}', item.label);
        li.innerHTML = itemContent;
        ul.appendChild(li);

        // 若章节还有子章节，递归生成目录（默认目录折叠）
        if (item.subitems && item.subitems.length) {
            li.appendChild(generateToc(item.subitems, true));
        }
    });

    return ul;
}

// 目录列表中每个章节的事件处理程序（事件委托）
document.getElementsByClassName('toc')[0]
    .addEventListener('click', function (e) {
        var target = e.target;
        if (target && target.nodeName.toLocaleLowerCase() === 'a' && target.className.indexOf('chapter-url') !== -1) {
            var href = target.getAttribute('href');
            book.goto(href);
            e.preventDefault();
            console.log(href);
        }
    });

// 章节折叠的事件处理程序（事件委托）
document.getElementsByClassName('toc')[0]
    .addEventListener('click', function (e) {
        var target = e.target;
        if (target && target.className.indexOf('item-mark') !== -1) {
            var subChapList = target.parentNode.nextElementSibling;
            if (subChapList && subChapList.className.indexOf('chapter-list') !== -1) {
                // IE 不支持此方法
                if (subChapList.classList.contains('collapse')) {
                    subChapList.classList.remove('collapse');
                    subChapList.classList.add('expand');
                    changeHeight(subChapList, false);
                } else {
                    subChapList.classList.remove('expand');
                    subChapList.classList.add('collapse');
                    changeHeight(subChapList, true);
                }
                e.preventDefault();
            }
        }
    });

// 计算被隐藏的章节列表本来的高度元素的高度
function getListHeight(element) {
    var e,
        height = 0,
        i,
        dataHeight;
    for (i = 0; i < element.childNodes.length; i++) {
        e = element.childNodes[i]; // e 为 ul 下的 li 元素
        if (e.nodeType === 1) {
            dataHeight = e.getAttribute('data-height');
            height = dataHeight ? (height + parseFloat(dataHeight)) : (height + e.offsetHeight);
        }
    }
    return height;
}

// 目录列表展开或折叠时改变其高度
// 第二个参数为true则折叠，false则展开
function changeHeight(element, collapse) {
    element.style.height = collapse ? '0' : (getListHeight(element) + 'px');

    // 下面的代码是为了解决由于transition造成的bug
    var li = element.parentNode,
        liHeight = li.offsetHeight;
    liHeight = collapse ? (liHeight - getListHeight(element)) : (liHeight + getListHeight(element));
    li.setAttribute('data-height', liHeight + ''); // 记录当前包含element的li元素应有的高度，以便element的父ul计算自己的高度

    var parentList = element.parentNode.parentNode;
    while (parentList.classList.contains('chapter-list') && !parentList.classList.contains('root-list')) {
        parentList.style.height = getListHeight(parentList) + 'px';
        parentList = parentList.parentNode.parentNode;
    }
}

// toc-button 的事件处理程序
document.getElementsByClassName('toc-button')[0]
    .addEventListener('click', function (e) {
        var self = this;
        self.classList.contains('on') ? this.classList.remove('on') : this.classList.add('on');
        tocSide.visible = self.classList.contains('on');
    });

// 翻页快捷键的事件处理程序
EPUBJS.Hooks.register("beforeChapterDisplay").pageTurns = function (callback, renderer) {
    var lock = false;
    var arrowKeys = function (e) {
        e.preventDefault();
        if (lock) return;

        if (e.keyCode == 37 || e.keyCode == 38) {
            book.prevPage();
            lock = true;
            setTimeout(function () {
                lock = false;
            }, 100);
            return false;
        }

        if (e.keyCode == 39 || e.keyCode == 40) {
            book.nextPage();
            lock = true;
            setTimeout(function () {
                lock = false;
            }, 100);
            return false;
        }

    };
    var mouse = function (e) {
        e.preventDefault();
        if (lock) return;

        if (e.wheelDelta > 0) {
            book.prevPage();
            lock = true;
            setTimeout(function () {
                lock = false;
            }, 100);
            return false;
        }

        if (e.wheelDelta < 0) {
            book.nextPage();
            lock = true;
            setTimeout(function () {
                lock = false;
            }, 100);
            return false;
        }
    };
    renderer.doc.addEventListener('keydown', arrowKeys, false);
    renderer.doc.addEventListener('mousewheel', mouse, false);
    if (callback) callback();
};

// 添加翻页动画
EPUBJS.Hooks.register('beforeChapterDisplay').pageAnimation = function (callback, renderer) {
    window.setTimeout(function () {
        var style = renderer.doc.createElement("style");
        style.innerHTML = "*{-webkit-transition: transform {t} ease;-moz-transition: tranform {t} ease;-o-transition: transform {t} ease;-ms-transition: transform {t} ease;transition: transform {t} ease;}";
        style.innerHTML = style.innerHTML.split("{t}").join("0.5s");
        renderer.doc.body.appendChild(style);
    }, 100);
    if (callback) {
        callback();
    }
};

// 添加此段代码使支持翻页动画
EPUBJS.Render.Iframe.prototype.setLeft = function (leftPos) {
    this.docEl.style[this.transform] = 'translate(' + (-leftPos) + 'px, 0)';
};

/* tool-bar 的事件处理程序 */

// 鼠标移入 tool-bar 则显示
document.getElementById('tool-bar')
    .addEventListener('mouseover', function (e) {
            var bar = document.getElementById('tool-bar'),
                left = parseFloat(document.defaultView.getComputedStyle(bar, null).left),
                maxLeft = window.innerWidth - parseFloat(document.defaultView.getComputedStyle(bar, null).width);

            //console.log(e.target.nodeName.toLocaleLowerCase() + "触发了mouseover");

            if (bar.getAttribute('data-hide') === 'true') {
                bar.style.opacity = '1';
                bar.style.transform = '';
                bar.setAttribute('data-hide', 'false');
            }
        }
    );

// 鼠标移出 tool-bar 则隐藏
document.getElementById('tool-bar')
    .addEventListener('mouseout', function (e) {
        var bar = document.getElementById('tool-bar'),
            left = parseFloat(document.defaultView.getComputedStyle(bar, null).left),
            maxLeft = window.innerWidth - parseFloat(document.defaultView.getComputedStyle(bar, null).width);

        //console.log(e.target.nodeName.toLocaleLowerCase() + "触发了mouseout");

        // 只处理 .tool-bar 触发的 mouseout 事件
        if (bar.getAttribute('data-hide') !== 'true') {
            if (left >= maxLeft) {
                setTimeout(function () {
                    if (bar.getAttribute('data-hide') === 'true') {
                        left = parseFloat(document.defaultView.getComputedStyle(bar, null).left);
                        if (left >= maxLeft) // 解决拖太快的bug（鼠标移出两秒后，若元素仍然在需要用transform隐藏的范围内，则使用transform隐藏）
                            bar.style.transform = 'translateX(250px)'; // todo 自动计算宽度
                        bar.style.opacity = '.2';
                    }
                }, 2000); // 鼠标移出两秒后，若tool-bar的data-hide属性仍然为true，则隐藏
            } else {
                setTimeout(function () {
                    if (bar.getAttribute('data-hide') === 'true')
                        bar.style.opacity = '.2';
                }, 2000);
            }
            bar.setAttribute('data-hide', 'true');
        }
    });

// tool-bar 退出按钮的事件处理程序
document.getElementById('exit')
    .addEventListener('click', function (e) {
        window.location = 'index.html';
    });

// tool-bar 书签按钮的事件处理程序
document.getElementById('book-mark')
    .addEventListener('click', function (e) {
        // todo
    });

// tool-bar 调色按钮的事件处理程序
document.getElementById('color')
    .addEventListener('click', function (e) {
        // todo
    });

// tool-bar 设置按钮的事件处理程序
document.getElementById('setting')
    .addEventListener('click', function (e) {
        // todo
    });

// tool-bar 全屏按钮的事件处理程序
document.getElementById('full-screen')
    .addEventListener('click', function (e) {
        var de = document.documentElement;

        if (de.requestFullscreen) {
            de.requestFullscreen();
        } else if (de.mozRequestFullScreen) {
            de.mozRequestFullScreen();
        } else if (de.msRequestFullscreen) {
            de.msRequestFullscreen();
        } else if (de.webkitRequestFullscreen) {
            de.webkitRequestFullScreen();
        }
    });

// tool-bar 恢复屏幕大小按钮的事件处理程序
document.getElementById('normal-screen')
    .addEventListener('click', function (e) {

        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }

        // todo 恢复进度
    });

window.onload = function () {
    init();

    new QiuDrag('tool-bar');

    // 触发 tool-bar 隐藏效果
    var evt = document.createEvent('MouseEvents');
    evt.initEvent('mouseout', true, true);
    document.getElementById('tool-bar').dispatchEvent(evt);
};
