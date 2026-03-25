@IsTest
private class TetrisControllerTest {

    @IsTest
    static void testSaveScore() {
        Test.startTest();
        TetrisController.saveScore('TestPlayer', 1500, 10, 2);
        Test.stopTest();

        List<Score__c> scores = [
            SELECT Player_Name__c, Score__c, Lines_Cleared__c, Level__c
            FROM Score__c
            WHERE Player_Name__c = 'TestPlayer'
        ];
        System.assertEquals(1, scores.size(), 'Should have saved one score');
        System.assertEquals(1500, scores[0].Score__c, 'Score should be 1500');
        System.assertEquals(10, scores[0].Lines_Cleared__c, 'Lines should be 10');
        System.assertEquals(2, scores[0].Level__c, 'Level should be 2');
    }

    @IsTest
    static void testGetHighScores() {
        // Insert some test scores
        List<Score__c> testScores = new List<Score__c>{
            new Score__c(Player_Name__c = 'Alice', Score__c = 5000, Lines_Cleared__c = 40, Level__c = 5),
            new Score__c(Player_Name__c = 'Bob',   Score__c = 3000, Lines_Cleared__c = 25, Level__c = 3),
            new Score__c(Player_Name__c = 'Carol', Score__c = 1000, Lines_Cleared__c = 8,  Level__c = 1)
        };
        insert testScores;

        Test.startTest();
        List<Score__c> results = TetrisController.getHighScores();
        Test.stopTest();

        System.assertNotEquals(0, results.size(), 'Should return scores');
        // Verify descending order
        if (results.size() >= 2) {
            System.assert(
                results[0].Score__c >= results[1].Score__c,
                'Scores should be in descending order'
            );
        }
    }

    @IsTest
    static void testGetHighScoresEmpty() {
        Test.startTest();
        List<Score__c> results = TetrisController.getHighScores();
        Test.stopTest();
        System.assertNotEquals(null, results, 'Should return an empty list, not null');
    }

    @IsTest
    static void testSaveScoreMinimal() {
        Test.startTest();
        TetrisController.saveScore('MinPlayer', 0, 0, 1);
        Test.stopTest();

        List<Score__c> scores = [SELECT Score__c FROM Score__c WHERE Player_Name__c = 'MinPlayer'];
        System.assertEquals(1, scores.size(), 'Should save a zero score');
        System.assertEquals(0, scores[0].Score__c, 'Score should be 0');
    }
}
