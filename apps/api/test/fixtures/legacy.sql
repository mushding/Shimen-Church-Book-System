-- MySQL dump 10.13  Distrib 8.0.33 (synthetic fixture)
DROP TABLE IF EXISTS `Appointment`;
CREATE TABLE `Appointment` (
  `pkId` int NOT NULL AUTO_INCREMENT,
  `userId` varchar(45) NOT NULL,
  `title` varchar(45) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `roomName` varchar(45) NOT NULL,
  `categoryName` varchar(45) NOT NULL,
  `flyyoungTeamName` varchar(45) DEFAULT NULL,
  `startDate` varchar(45) NOT NULL,
  `endDate` varchar(45) NOT NULL,
  `rRule` varchar(255) NOT NULL,
  `exDate` varchar(4000) DEFAULT NULL,
  `createTime` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updateTime` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pkId`),
  KEY `userId` (`userId`)
) ENGINE=InnoDB AUTO_INCREMENT=1003 DEFAULT CHARSET=latin1;
LOCK TABLES `Appointment` WRITE;
INSERT INTO `Appointment` VALUES (1000,'U459767a6e915e5fc8749df6de1926adf','青少契 週五','it\'s note, with \\ backslash','正堂','青少契',NULL,'2023-07-07T11:30:00Z','2023-07-07T13:30:00Z','FREQ=WEEKLY;BYDAY=FR;UNTIL=20231229T160000Z','20230714T113000Z,20230721T113000Z','2023-07-01 10:00:00','2023-07-01 10:00:00'),(1001,'U459767a6e915e5fc8749df6de1926adf','小組聚會',NULL,'地下室小','小組','','2024-06-30T05:00+08:00','2024-06-30T13:00+08:00','','','2024-06-01 10:00:00','2024-06-01 10:00:00'),(1002,'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','雙語營大會','','石小禮堂','雙語營','大會','2025-07-01T01:00:00Z','2025-07-01T09:00:00Z','FREQ=DAILY;COUNT=5',NULL,'2025-06-01 10:00:00','2025-06-01 10:00:00'),(1003,'U459767a6e915e5fc8749df6de1926adf','未知場地','','三樓新教室','教會',NULL,'2025-08-01T01:00:00Z','2025-08-01T02:00:00Z','',NULL,NULL,NULL);
UNLOCK TABLES;
DROP TABLE IF EXISTS `User`;
CREATE TABLE `User` (
  `userId` varchar(45) NOT NULL,
  `name` varchar(45) NOT NULL,
  `pictureUrl` varchar(255) NOT NULL,
  `email` varchar(45) NOT NULL,
  `lastLoginMethod` varchar(45) NOT NULL,
  `role` varchar(45) NOT NULL,
  `createTime` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updateTime` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
LOCK TABLES `User` WRITE;
INSERT INTO `User` VALUES ('U459767a6e915e5fc8749df6de1926adf','彭啟恩','https://profile.line-scdn.net/abc','ajy@example.com','lineqr','admin','2023-06-01 00:00:00','2023-06-01 00:00:00'),('Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','某人','','','line','user','2024-01-01 00:00:00','2024-01-01 00:00:00');
UNLOCK TABLES;
