public with sharing class TetrisController {

    @AuraEnabled
    public static void saveScore(String playerName, Integer score, Integer linesCleared, Integer level) {
        Score__c s = new Score__c(
            Player_Name__c = playerName,
            Score__c = score,
            Lines_Cleared__c = linesCleared,
            Level__c = level
        );
        insert s;
    }

    @AuraEnabled(cacheable=true)
    public static List<Score__c> getHighScores() {
        return [
            SELECT Player_Name__c, Score__c, Lines_Cleared__c, Level__c, CreatedDate
            FROM Score__c
            ORDER BY Score__c DESC
            LIMIT 10
        ];
    }
}
