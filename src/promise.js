!function (root, factory) {
  if (typeof define === 'function' && define.amd)
    define([], factory);
  else if (typeof module === 'object' && module.exports)
    module.exports = factory();
  else
    root.Promise = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  function Promise(callback) {
    function resolve(data) {
      if (data instanceof Promise) {
        data.then(resolve, reject);
      } else {
        _this.$$status = 'resolved';
        _this.$$value = data;
        then();
      }
    }
    function reject(error) {
      _this.$$status = 'rejected';
      _this.$$value = error;
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
        var resolved = _this.$$status === 'resolved';
        var handler = resolved ? okHandler : errHandler;
        if (handler)
          try {
            result = handler(_this.$$value);
          } catch (e) {
            return reject(e);
          }
        else {
          result = _this.$$value;
          if (!resolved) return reject(result);
        }
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
        if (results) {
          results = null;
          reject(data);
        }
      }
      function resolveOne(data, i) {
        if (results) {
          results[i] = data;
          pending --;
          check();
        }
      }
      function check() {
        results && !pending && resolve(results);
      }
      var results = [];
      var pending = promises.length;
      promises.forEach(function (promise, i) {
        if (promise instanceof Promise) {
          promise.then(function (data) {
            resolveOne(data, i);
          }, function (data) {
            rejectAll(data);
          });
        } else {
          resolveOne(promise, i);
        }
      });
      check();
    });
  };
  return Promise;
});
