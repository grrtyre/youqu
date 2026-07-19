using System;
using System.Windows;
using AlarmManager.Portable.Core;
using AlarmManager.Portable.Models;

namespace AlarmManager.Portable
{
    /// <summary>
    /// 闹钟触发窗口 - 显示触发信息，贪睡/确定操作
    /// </summary>
    public partial class TriggerWindow : Window
    {
        private readonly Alarm _alarm;

        public TriggerWindow(Alarm alarm)
        {
            InitializeComponent();
            _alarm = alarm;

            TimeText.Text = AlarmEngine.FormatTime(alarm.Hour, alarm.Minute);
            LabelText.Text = alarm.Label;
            RepeatText.Text = AlarmEngine.DescribeRepeat(alarm.Repeat);

            // 贪睡按钮文本
            UpdateSnoozeButton();

            // 关闭时停止铃声
            Closed += (s, e) => ((App)Application.Current).StopRinging();

            // 窗口失焦不隐藏（与主窗口不同 - 触发窗口必须强提醒）
            // 但 Esc 键可关闭
            KeyDown += (s, e) =>
            {
                if (e.Key == System.Windows.Input.Key.Escape) BtnDismiss_Click(s, e);
                if (e.Key == System.Windows.Input.Key.Space) BtnSnooze_Click(s, e);
            };
        }

        private void UpdateSnoozeButton()
        {
            int remaining = _alarm.MaxSnoozeCount - _alarm.SnoozeCount;
            if (remaining > 0)
            {
                BtnSnooze.Content = "💤 贪睡 " + _alarm.SnoozeMinutes + " 分钟";
                BtnSnooze.IsEnabled = true;
            }
            else
            {
                BtnSnooze.Content = "💤 已贪睡 " + _alarm.SnoozeCount + " 次（上限）";
                BtnSnooze.IsEnabled = false;
            }
        }

        private void BtnSnooze_Click(object sender, RoutedEventArgs e)
        {
            bool ok = AlarmEngine.Snooze(_alarm);
            if (ok)
            {
                Store.AppendLog(App.Data, new TriggerLog
                {
                    Time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    AlarmId = _alarm.Id,
                    Label = _alarm.Label,
                    Action = "snoozed"
                });
                Store.Save(App.Data, App.DataFile);
                Close();
            }
            else
            {
                BtnSnooze.IsEnabled = false;
                BtnSnooze.Content = "💤 贪睡次数已用尽";
            }
        }

        private void BtnDismiss_Click(object sender, RoutedEventArgs e)
        {
            Store.AppendLog(App.Data, new TriggerLog
            {
                Time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                AlarmId = _alarm.Id,
                Label = _alarm.Label,
                Action = "dismissed"
            });
            Store.Save(App.Data, App.DataFile);
            Close();
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            // 与确定相同：记录并关闭
            BtnDismiss_Click(sender, e);
        }
    }
}
