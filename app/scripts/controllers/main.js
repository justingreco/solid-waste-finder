'use strict';
/**
 * @ngdoc function
 * @name solidWasteFinderApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the solidWasteFinderApp
 */
angular.module('solidWasteFinderApp')
  .controller('MainCtrl', function ($scope, $http, $timeout, geolocation) {
    var map, from, locationGroup, closestFacility;
    $scope.features = [];
    var facilities = null;
    $scope.userType = {
      home: true,
      business: true
    };
    $scope.isResident = true;
    $scope.isBusiness = true;
    var addLocationToMap = function (latlng) {
      var icon = L.icon({
        iconUrl: 'images/location.png',
        iconSize: [14,14]
      });
      locationGroup.clearLayers();
      locationGroup.addLayer(L.marker(latlng, {icon:icon}));
    };
    var measureDistance = function (from, features) {
      angular.forEach(features, function (feature) {
        var distance = turf.distance(from, feature, "miles");
        console.log(feature.geometry.coordinates);
        console.log(distance);
        feature.properties.DISTANCE = distance;
      });
      return features;
    };
    var findNearest = function (from, featureCollection) {
      var nearest = turf.nearest(from, featureCollection);
      var bounds = L.geoJson(from).getBounds();
      bounds = bounds.extend(L.geoJson(nearest).getBounds());
      map.fitBounds([bounds], {padding: [100,100]});
      closestFacility.clearLayers();
      var redMarker = L.AwesomeMarkers.icon({
        icon: 'trash',
        markerColor: 'red'
      });
      var marker =  L.marker([nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]], {icon: redMarker, zIndexOffset: 100}).bindPopup('<strong>' + nearest.properties.OPERATOR + '</strong><br/>' +nearest.properties.TYPE + '<br/>' + nearest.properties.ADDRESS + '<br/>' + nearest.properties.HOURS + '<strong><br/>' + nearest.properties.OPENTO + '<br/><a href="' + createDirectionsLink(from.geometry.coordinates, nearest.geometry.coordinates) + '">Directions</a>');
      closestFacility.addLayer(marker);
      marker.openPopup();
    }
    var createDirectionsLink = function (fromCoords, toCoords) {
        return "https://www.google.com/maps/dir/"+fromCoords[1]+","+fromCoords[0]+"/"+toCoords[1]+","+toCoords[0];
    }
    $scope.getLocation = function () {
      $scope.geolocating = true;
      geolocation.getLocation().then(function (data) {
        console.log(data);
        $scope.geolocating = false;
        from = {"type": "Feature", "properties": {}, "geometry": {"type": "Point", "coordinates": [data.coords.longitude, data.coords.latitude]}};
        addLocationToMap([data.coords.latitude, data.coords.longitude]);
        $scope.query();
        facilities.bindPopup(function (feature) {
          return L.Util.template('<strong>{OPERATOR}</strong><br/>{TYPE}<br/>{ADDRESS}<br/>{HOURS}<strong><br/>{OPENTO}<br/><a href="' + createDirectionsLink(from.geometry.coordinates, feature.geometry.coordinates) + '">Directions</a>', feature.properties);
        });
      });
    };
    $scope.query = function () {
      console.log('query');
      var whereArr = [];
      var where = "";
      if ($scope.material) {
        var categories = "'" + $scope.material.categories.toString().replace(/,/g, "','") + "'";
        whereArr.push ("CATEGORY IN (" + categories + ")");
      }
      if ($scope.userType.home && $scope.userType.business) {

      } else if ($scope.userType.home) {
        whereArr.push("OPENTO IN ('Residents and Businesses', 'Residents only')");
      } else if ($scope.userType.business) {
        whereArr.push("OPENTO IN ('Residents and Businesses', 'Businesses only')");
      }
      if (whereArr.length === 0) {
        where = "1=1";
      } else if (whereArr.length === 1) {
        where = whereArr[0];
      } else {
        where = whereArr[0] + " AND " + whereArr[1];
      }
      facilities.query().where(where).run(function (error, featureCollection) {
        if (from) {
          findNearest(from, featureCollection);
          $scope.features = measureDistance(from, featureCollection.features);
        }
        $scope.features = featureCollection.features;
        if(!$scope.$$phase) {
          $scope.$digest();
        }
      });
      facilities.setWhere(where);
    };
    $scope.filterByCategory = function (facility) {
      console.log('filter');
      var openTo = [];
      if ($scope.isResident && $scope.isBusiness) {
        openTo = ["Residents and Businesses", "Residents only", "Businesses only"];
      } else if ($scope.userType.home) {
        openTo = ["Residents and Businesses", "Residents only"];
      } else if ($scope.userType.business) {
        openTo = ["Residents and Businesses", "Businesses only"];
      }
      if ($scope.material && openTo.length > 0) {
        return $scope.material.categories.indexOf(facility.feature.properties.CATEGORY) > -1 && openTo.indexOf(facility.feature.properties.OPENTO) > -1;
      } else if ($scope.material) {
        return $scope.material.categories.indexOf(facility.feature.properties.CATEGORY) > -1;
      } else if (openTo.length > 0) {
        return openTo.indexOf(facility.feature.properties.OPENTO) > -1;
      } else {
        return true;
      }
    };
    $scope.userTypeChanged =  function () {
      $timeout(function () {
        $scope.query();
      });
    };
    var createMap = function () {
      map = L.map('map').setView([35.81889, -78.64447], 10);
      L.esri.basemapLayer('Gray').addTo(map);
      facilities = L.esri.featureLayer('http://maps.wakegov.com/arcgis/rest/services/Environmental/SWFacilities/MapServer/0', {
        cacheLayers: false,
       pointToLayer: function (geojson, latlng) {
          var blueMarker = L.AwesomeMarkers.icon({
            icon: 'trash',
            markerColor: 'blue'
          });
          return L.marker(latlng, {
            icon: blueMarker
          });
        }
      }).addTo(map);
      facilities.bindPopup(function (feature) {
        return L.Util.template('<strong>{OPERATOR}</strong><br/>{TYPE}<br/>{ADDRESS}<br/>{HOURS}<strong><br/>{OPENTO}', feature.properties);
      });
      $scope.query();
      locationGroup = L.featureGroup().addTo(map);
      closestFacility = L.featureGroup().addTo(map);
    };
    var getMaterials = function () {
      $http.get("data/materials.json").success(function (data) {
        $scope.materials = data;
      });
    };
    getMaterials();
    createMap();
  });