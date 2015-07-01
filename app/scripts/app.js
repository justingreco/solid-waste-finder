'use strict';

/**
 * @ngdoc overview
 * @name solidWasteFinderApp
 * @description
 * # solidWasteFinderApp
 *
 * Main module of the application.
 */
angular
  .module('solidWasteFinderApp', [
    'ngAnimate',
    'ngCookies',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch',
    'ui.bootstrap',
    'geolocation','angular-toArrayFilter'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl'
      })
      .when('/about', {
        templateUrl: 'views/about.html',
        controller: 'AboutCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
