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
  var map, facilities, from, locationGroup, closestFacility;
  $scope.features = [];
  $scope.userType = 'resident';
  $scope.showDistance = false;
  $scope.searchByLocation = function (input) {
    if (/^\d+$/.test(input) && input.length === 5) {
      searchByZip(input);
    } else {
      geocode(input);
    }
  };
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
    var whereArr = [], where = "";
    if ($scope.material) {
      var categories = "'" + $scope.material.categories.toString().replace(/,/g, "','") + "'";
      whereArr.push ("CATEGORY IN (" + categories + ")");
    }
    if ($scope.userType === 'resident') {
      whereArr.push("OPENTO IN ('Residents and Businesses', 'Residents only')");
    } else if ($scope.userType === 'business') {
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
  $scope.userTypeChanged =  function () {
    $timeout(function () {
      $scope.query();
    });
  };
  $scope.tableRowClicked = function (facility) {
    map.setView([facility.geometry.coordinates[1], facility.geometry.coordinates[0]], 16);
  };

  var addLocationToMap = function (latlng) {
    var icon = L.icon({
      iconUrl: 'images/location.png',
      iconSize: [14,14]
    });
    locationGroup.clearLayers();
    locationGroup.addLayer(L.marker(latlng, {icon:icon}));
  };
  var measureDistance = function (from, features) {
    $scope.showDistance = true;
    angular.forEach(features, function (feature) {
      var distance = turf.distance(from, feature, "miles");
      console.log(feature.geometry.coordinates);
      console.log(distance);
      feature.properties.DISTANCE = distance;
    });
    return features;
  };
  var findNearest = function (from, featureCollection) {
    var marker, nearest = turf.nearest(from, featureCollection),
    bounds = L.geoJson(from).getBounds();
    bounds = bounds.extend(L.geoJson(nearest).getBounds());
    map.fitBounds([bounds], {padding: [135,135]});
    closestFacility.clearLayers();
    var redMarker = L.AwesomeMarkers.icon({
      icon: 'trash',
      markerColor: 'red'
    });
    marker =  L.marker([nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]], {icon: redMarker, zIndexOffset: 100}).bindPopup('<strong>' + nearest.properties.OPERATOR + '</strong><br/>' +nearest.properties.TYPE + '<br/>' + nearest.properties.ADDRESS + '<br/>' + nearest.properties.HOURS + '<strong><br/>' + nearest.properties.OPENTO + '<br/><a href="' + createDirectionsLink(from.geometry.coordinates, nearest.geometry.coordinates) + '">Directions</a>');
    closestFacility.addLayer(marker);
    marker.openPopup();
  }
  var createDirectionsLink = function (fromCoords, toCoords) {
    return "https://www.google.com/maps/dir/"+fromCoords[1]+","+fromCoords[0]+"/"+toCoords[1]+","+toCoords[0];
  }
  var searchByZip = function (zip) {
    var q = L.esri.Tasks.query({url: 'https://maps.raleighnc.gov/arcgis/rest/services/Boundaries/MapServer/12'});
    q.where("ZIPNUM = " + zip);
    q.run(function (error, featureCollection) {
      var center = turf.centroid(featureCollection);
      from = center;
      addLocationToMap([center.geometry.coordinates[1], center.geometry.coordinates[0]]);
      $scope.query();
    });
  };
  var geocode = function (text) {
    $http({
      url: 'https://maps.raleighnc.gov/arcgis/rest/services/Locators/Locator/GeocodeServer/findAddressCandidates',
      method: 'GET',
      params: {
        'Single Line Input': text,
        outSR: 4326,
        f: 'json'
      }
    }).success(function (data) {
      if (data.candidates.length > 0) {
        var loc = L.esri.Util.arcgisToGeojson(data.candidates[0].location);
        loc = { type: 'Feature', properties: {}, geometry: loc};
        from = loc;
        addLocationToMap([loc.geometry.coordinates[1], loc.geometry.coordinates[0]]);
        $scope.query();
      }
    });
  }
  var createMap = function () {
    map = L.map('map').setView([35.80, -78.64447], 10);
    L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
    }).addTo(map);
    facilities = L.esri.featureLayer('http://maps.wakegov.com/arcgis/rest/services/Environmental/SWFacilities/MapServer/0', {
      cacheLayers: false,
      pointToLayer: function (geojson, latlng) {
        var color = 'blue', marker;
        switch (geojson.properties.CATEGORY) {
          case 'multimaterial':
          color = 'green';
          break;
          case 'convenience':
          color = 'blue';
          break;
          case 'municipal':
          color = 'purple';
          break;
          case 'household':
          color = 'orange';
          break;
        }
        marker = L.AwesomeMarkers.icon({
          icon: 'trash',
          markerColor: color
        });
        return L.marker(latlng, {
          icon: marker
        });
      }
    }).addTo(map);
    L.esri.featureLayer('http://maps.raleighnc.gov/arcgis/rest/services/BaseMapBasic/MapServer/0', {
      style: function (feature) {
        return {color: 'black', weight: 2, fillOpacity: 0, opacity: 0.10};
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
