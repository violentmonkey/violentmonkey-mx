function Promise(callback) {
  function resolve(data) {
    _this.$$status = 'resolved';
    _this.$$value = data;
    then();
  }
  function reject(data) {
    _this.$$status = 'rejected';
    _this.$$value = data;
    then();
  }
  function then() {
    var callbacks = _this.$$callbacks;
    _this.$$callbacks = [];
    callbacks.forEach(function (callback) {
      callback();
    });
  }
  var _this = this;
  _this.$$status = 'pending';
  _this.$$value = null;
  _this.$$callbacks = [];
  callback(resolve, reject);
}
Promise.prototype.then = function (okHandler, errHandler) {
  var _this = this;
  return new Promise(function (resolve, reject) {
    function callback() {
      var result;
      var handler = _this.$$status === 'resolved' ? okHandler : errHandler;
      if (handler) try {
        result = handler(_this.$$value);
      } catch (e) {
        return reject(e);
      }
      if (result instanceof Promise)
        result.then(resolve, reject);
      else
        resolve(result);
    }
    if (_this.$$status === 'pending') _this.$$callbacks.push(callback);
    else callback();
  });
};
Promise.prototype.catch = function (errHandler) {
  return this.then(null, errHandler);
};
Promise.resolve = function (data) {
  return new Promise(function (resolve) {
    resolve(data);
  });
};
Promise.reject = function (data) {
  return new Promise(function (resolve, reject) {
    reject(data);
  });
};
Promise.all = function (promises) {
  return new Promise(function (resolve, reject) {
    function rejectAll(data) {
      if (rejected) return;
      rejected = true;
    }
    function resolveOne(data, i) {
      results[i] = data;
      if (!-- pending) resolve(results);
    }
    var results = [];
    var rejected = false;
    var pending = promises.length;
    promises.forEach(function (promise, i) {
      if (promise instanceof Promise)
        promise.then(function (data) {
          resolveOne(data, i);
        }, function (data) {
          rejectAll(data);
        });
      else
        results[i] = promise;
    });
  });
};
